import { arrayRemove, arrayUnion, collection, doc, increment, writeBatch } from 'firebase/firestore'
import { db } from './firebase'
import { FirestoreCollections } from './firestoreCollections'
import { loadActiveEntries, loadBanks, type SimulationEntry } from './dinluxData'
import { purchaseCycles, savingsPeriods, unseenAlertsCount, type Period } from './simulationCalc'

const NOME_BANCO_EXCLUIDO = 'Banco excluído'

export type AvisoSection = {
  entry: SimulationEntry
  tipo: 'PURCHASE' | 'SAVINGS'
  titulo: string
  subtitulo: string
  bankId: string
  bankName: string
  mensagens: Period[]
  finalizada: boolean
  naoVistasCount: number
  cardFechamentoAlterado: boolean
  cardFechamentoAtual: number
  ordenacao: number
}

export type AvisoContact = {
  bankId: string
  bankName: string
  naoVistasCount: number
  ordenacao: number
}

function entriesRef(uid: string) {
  return collection(db, FirestoreCollections.USERS, uid, FirestoreCollections.SIMULATION_ENTRIES)
}

function bankRef(uid: string, bankId: string) {
  return doc(db, FirestoreCollections.USERS, uid, FirestoreCollections.BANKS, bankId)
}

function startOfDayMillis(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

function sectionOrdenacao(entry: SimulationEntry, mensagens: Period[]): number {
  const referencia = mensagens.find((m) => !m.paid) ?? mensagens[mensagens.length - 1]
  return referencia?.key ?? entry.createdAt
}

export async function loadUnseenAlertsTotal(uid: string): Promise<number> {
  const [banks, groups] = await Promise.all([loadBanks(uid), loadActiveEntries(uid)])
  const today = new Date()
  let total = 0

  for (const { entries } of groups) {
    for (const entry of entries) {
      if (entry.avisosArquivado) continue

      if (entry.type === 'SAVINGS') {
        total += unseenAlertsCount(entry, savingsPeriods(entry, today))
        continue
      }

      let dueDay: number
      if (entry.paymentMethod === 'CREDIT') {
        const card = banks.find((bank) => bank.id === entry.bankId)?.cards.find((c) => c.id === entry.cardId)
        dueDay = card?.dueDay ?? 0
      } else {
        dueDay = new Date(entry.createdAt).getDate()
      }
      total += unseenAlertsCount(entry, purchaseCycles(entry, dueDay, today))
    }
  }
  return total
}

/** Monta o histórico de sessões (uma por lançamento com pendências), igual ao app. */
export async function loadAvisoSections(uid: string): Promise<AvisoSection[]> {
  const [banks, groups] = await Promise.all([loadBanks(uid), loadActiveEntries(uid)])
  const today = new Date()
  const sections: AvisoSection[] = []

  for (const { entries } of groups) {
    for (const entry of entries) {
      if (entry.avisosArquivado) continue
      const bank = banks.find((b) => b.id === entry.bankId)
      const bankName = bank?.name ?? NOME_BANCO_EXCLUIDO

      if (entry.type === 'SAVINGS') {
        const mensagens = savingsPeriods(entry, today)
        if (mensagens.length === 0) continue
        const endStart = startOfDayMillis(new Date(entry.endDate))
        const finalizada = startOfDayMillis(today) >= endStart
        sections.push({
          entry,
          tipo: 'SAVINGS',
          titulo: entry.title,
          subtitulo: 'Economia',
          bankId: entry.bankId,
          bankName,
          mensagens,
          finalizada,
          naoVistasCount: unseenAlertsCount(entry, mensagens),
          cardFechamentoAlterado: false,
          cardFechamentoAtual: 0,
          ordenacao: sectionOrdenacao(entry, mensagens),
        })
        continue
      }

      const card = bank?.cards.find((c) => c.id === entry.cardId)
      const dueDay = entry.paymentMethod === 'CREDIT' ? card?.dueDay ?? 0 : new Date(entry.createdAt).getDate()
      if (dueDay <= 0) continue
      const mensagens = purchaseCycles(entry, dueDay, today)
      if (mensagens.length === 0) continue

      const finalizada = entry.paidInstallments >= entry.installments
      const subtitulo = entry.paymentMethod === 'CREDIT' ? `Cartão ${entry.cardLabel}` : 'Débito'
      const fechamentoAlterado =
        entry.paymentMethod === 'CREDIT' &&
        !!card &&
        entry.cardClosingDay > 0 &&
        card.closingDay > 0 &&
        card.closingDay !== entry.cardClosingDay

      sections.push({
        entry,
        tipo: 'PURCHASE',
        titulo: entry.title,
        subtitulo,
        bankId: entry.bankId,
        bankName,
        mensagens,
        finalizada,
        naoVistasCount: unseenAlertsCount(entry, mensagens),
        cardFechamentoAlterado: fechamentoAlterado,
        cardFechamentoAtual: fechamentoAlterado ? card!.closingDay : 0,
        ordenacao: sectionOrdenacao(entry, mensagens),
      })
    }
  }

  return sections.sort((a, b) => a.ordenacao - b.ordenacao)
}

export function contactsFromSections(sections: AvisoSection[]): AvisoContact[] {
  const byBank = new Map<string, AvisoContact>()
  for (const section of sections) {
    const current = byBank.get(section.bankId)
    if (!current) {
      byBank.set(section.bankId, {
        bankId: section.bankId,
        bankName: section.bankName,
        naoVistasCount: section.naoVistasCount,
        ordenacao: section.ordenacao,
      })
    } else {
      current.naoVistasCount += section.naoVistasCount
      current.ordenacao = Math.min(current.ordenacao, section.ordenacao)
    }
  }
  return Array.from(byBank.values()).sort((a, b) => a.ordenacao - b.ordenacao)
}

/** Todas as compras em crédito de simulações ativas (não filtra arquivadas) — usado só pra somar limite. */
export async function loadActiveCreditPurchases(uid: string): Promise<SimulationEntry[]> {
  const groups = await loadActiveEntries(uid)
  return groups.flatMap((group) => group.entries).filter((entry) => entry.type === 'PURCHASE' && entry.paymentMethod === 'CREDIT')
}

/** Marca ou desmarca UM período de uma economia como guardado de verdade. */
export async function toggleSavingsPeriod(uid: string, entry: SimulationEntry, periodKey: number, confirmar: boolean) {
  const sinal = confirmar ? 1 : -1
  const valor = entry.monthlyAmount
  const batch = writeBatch(db)
  batch.update(doc(entriesRef(uid), entry.id), {
    confirmedPeriods: confirmar ? arrayUnion(periodKey) : arrayRemove(periodKey),
    savedAmount: increment(valor * sinal),
  })
  batch.update(bankRef(uid, entry.bankId), { debit: increment(-valor * sinal) })
  await batch.commit()
}

/** Marca ou desmarca UMA parcela (ciclo de fatura, ou de um parcelamento em débito). */
export async function togglePurchaseCycle(uid: string, entry: SimulationEntry, periodKey: number, confirmar: boolean) {
  const sinal = confirmar ? 1 : -1
  const valor = entry.installmentValue
  const batch = writeBatch(db)
  batch.update(doc(entriesRef(uid), entry.id), {
    confirmedPeriods: confirmar ? arrayUnion(periodKey) : arrayRemove(periodKey),
    paidInstallments: increment(sinal),
  })
  batch.update(bankRef(uid, entry.bankId), { debit: increment(-valor * sinal) })
  await batch.commit()
}

/** Marca como vistas todas as mensagens pendentes atuais das sessões de um banco (ao abrir o chat dele). */
export async function markBankSeen(uid: string, sections: AvisoSection[]) {
  const comPendencia = sections.filter((section) => section.naoVistasCount > 0)
  if (comPendencia.length === 0) return
  const batch = writeBatch(db)
  for (const section of comPendencia) {
    const ultima = section.mensagens[section.mensagens.length - 1]
    if (!ultima) continue
    batch.update(doc(entriesRef(uid), section.entry.id), { ultimoPeriodoVisto: ultima.key })
  }
  await batch.commit()
}
