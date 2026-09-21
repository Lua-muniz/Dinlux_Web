import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from './firebase'
import { FirestoreCollections } from './firestoreCollections'

export type Card = {
  id: string
  label: string
  limit: number
  closingDay: number
  dueDay: number
  hasInterest: boolean
  interestRate: number
  usedAmount: number
}

export type Bank = {
  id: string
  name: string
  debit: number
  cards: Card[]
  bankCode: string
}

export type Simulation = {
  id: string
  title: string
  active: boolean
  createdAt: number
}

export type SimulationEntry = {
  id: string
  simulationId: string
  type: 'PURCHASE' | 'SAVINGS'
  title: string
  paymentMethod: 'DEBIT' | 'CREDIT' | null
  bankId: string
  cardId: string
  cardLabel: string
  cardClosingDay: number
  installments: number
  installmentValue: number
  paidInstallments: number
  targetValue: number
  startDate: number
  endDate: number
  monthlyAmount: number
  savedAmount: number
  avisosArquivado: boolean
  ultimoPeriodoVisto: number
  confirmedPeriods: number[]
  createdAt: number
}

export type StatementTransaction = {
  id: string
  bankId: string
  amount: number
  credit: boolean
}

function userCollection(uid: string, name: string) {
  return collection(db, FirestoreCollections.USERS, uid, name)
}

export async function loadBanks(uid: string): Promise<Bank[]> {
  const snapshot = await getDocs(userCollection(uid, FirestoreCollections.BANKS))
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    const cards: Card[] = (data.cards ?? []).map((raw: Partial<Card>) => ({
      id: raw.id ?? '',
      label: raw.label ?? '',
      limit: raw.limit ?? 0,
      closingDay: raw.closingDay ?? 0,
      dueDay: raw.dueDay ?? 0,
      hasInterest: raw.hasInterest ?? false,
      interestRate: raw.interestRate ?? 0,
      usedAmount: raw.usedAmount ?? 0,
    }))
    return {
      id: doc.id,
      name: data.name ?? '',
      debit: data.debit ?? 0,
      cards,
      bankCode: data.bankCode ?? '',
    }
  })
}

export async function loadSimulations(uid: string): Promise<Simulation[]> {
  const snapshot = await getDocs(userCollection(uid, FirestoreCollections.SIMULATIONS))
  return snapshot.docs
    .map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        title: data.title ?? '',
        active: data.active ?? false,
        createdAt: data.createdAt ?? 0,
      }
    })
    .filter((simulation) => simulation.title.trim() !== '')
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function loadEntries(uid: string, simulationId: string): Promise<SimulationEntry[]> {
  const snapshot = await getDocs(
    query(userCollection(uid, FirestoreCollections.SIMULATION_ENTRIES), where('simulationId', '==', simulationId)),
  )
  return snapshot.docs
    .map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        simulationId: data.simulationId ?? '',
        type: data.type ?? 'PURCHASE',
        title: data.title ?? '',
        paymentMethod: data.paymentMethod ?? null,
        bankId: data.bankId ?? '',
        cardId: data.cardId ?? '',
        cardLabel: data.cardLabel ?? '',
        cardClosingDay: data.cardClosingDay ?? 0,
        installments: data.installments ?? 1,
        installmentValue: data.installmentValue ?? 0,
        paidInstallments: data.paidInstallments ?? 0,
        targetValue: data.targetValue ?? 0,
        startDate: data.startDate ?? 0,
        endDate: data.endDate ?? 0,
        monthlyAmount: data.monthlyAmount ?? 0,
        savedAmount: data.savedAmount ?? 0,
        avisosArquivado: data.avisosArquivado ?? false,
        ultimoPeriodoVisto: data.ultimoPeriodoVisto ?? 0,
        confirmedPeriods: data.confirmedPeriods ?? [],
        createdAt: data.createdAt ?? 0,
      } as SimulationEntry
    })
    .sort((a, b) => a.createdAt - b.createdAt)
}

export async function loadActiveEntries(uid: string): Promise<{ simulation: Simulation; entries: SimulationEntry[] }[]> {
  const simulations = (await loadSimulations(uid)).filter((simulation) => simulation.active)
  return Promise.all(
    simulations.map(async (simulation) => ({ simulation, entries: await loadEntries(uid, simulation.id) })),
  )
}

export async function loadTransactions(uid: string, bankId: string): Promise<StatementTransaction[]> {
  const snapshot = await getDocs(
    query(userCollection(uid, FirestoreCollections.STATEMENT_TRANSACTIONS), where('bankId', '==', bankId)),
  )
  return snapshot.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      bankId: data.bankId ?? '',
      amount: data.amount ?? 0,
      credit: data.credit ?? false,
    }
  })
}
