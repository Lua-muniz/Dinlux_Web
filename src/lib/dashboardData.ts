import {
  loadActiveEntries,
  loadBanks,
  loadTransactions,
  type SimulationEntry,
} from './dinluxData'
import { availableCardLimit } from './simulationCalc'

export type BarEntry = {
  label: string
  value: number
  max: number
  highlighted: boolean
}

export type EntityChart = {
  label: string
  colorSourceId: string
  entries: BarEntry[]
}

export type SimulationSection = {
  title: string
  charts: EntityChart[]
  overallProgress: number
  hasEntries: boolean
}

export type BankPie = {
  bankName: string
  colorSourceId: string
  income: number
  expense: number
}

export type CardDonut = {
  cardLabel: string
  bankName: string
  colorSourceId: string
  used: number
  available: number
  closingDay: number
  dueDay: number
}

function entryValues(entry: SimulationEntry): [number, number] {
  return entry.type === 'SAVINGS'
    ? [entry.savedAmount, entry.targetValue]
    : [entry.paidInstallments, entry.installments]
}

function entryProportion(entry: SimulationEntry): number {
  const [value, max] = entryValues(entry)
  return max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0
}

export async function loadSimulationsChart(uid: string): Promise<SimulationSection[]> {
  const [banks, groups] = await Promise.all([loadBanks(uid), loadActiveEntries(uid)])
  const bankNames = new Map(banks.map((bank) => [bank.id, bank.name]))
  const bankName = (entry: SimulationEntry) => bankNames.get(entry.bankId) ?? 'Banco excluído'

  return groups.map(({ simulation, entries }) => {
    const byEntity = new Map<string, SimulationEntry[]>()
    for (const entry of entries) {
      const key = `${entry.bankId}|${entry.cardId}`
      byEntity.set(key, [...(byEntity.get(key) ?? []), entry])
    }

    const charts: EntityChart[] = [...byEntity.values()]
      .sort((a, b) => bankName(a[0]).localeCompare(bankName(b[0])) || a[0].cardLabel.localeCompare(b[0].cardLabel))
      .map((group) => {
        const first = group[0]
        const suffix = first.cardLabel.trim() !== '' ? first.cardLabel : 'Débito'
        return {
          label: `${bankName(first)} — ${suffix}`,
          colorSourceId: first.cardId || first.bankId,
          entries: group.map((entry) => {
            const [value, max] = entryValues(entry)
            return { label: entry.title, value, max, highlighted: entry.type === 'SAVINGS' }
          }),
        }
      })

    const overallProgress =
      entries.length === 0 ? 0 : entries.reduce((sum, entry) => sum + entryProportion(entry), 0) / entries.length

    return { title: simulation.title, charts, overallProgress, hasEntries: entries.length > 0 }
  })
}

export async function loadMovementsChart(uid: string): Promise<BankPie[]> {
  const banks = await loadBanks(uid)
  const pies = await Promise.all(
    banks.map(async (bank) => {
      const transactions = await loadTransactions(uid, bank.id)
      return {
        bankName: bank.name,
        colorSourceId: bank.id,
        income: transactions.filter((t) => t.credit).reduce((sum, t) => sum + t.amount, 0),
        expense: transactions.filter((t) => !t.credit).reduce((sum, t) => sum + Math.abs(t.amount), 0),
      }
    }),
  )
  return pies.sort((a, b) => b.income + b.expense - (a.income + a.expense))
}

export async function loadCardsChart(uid: string): Promise<CardDonut[]> {
  const [banks, groups] = await Promise.all([loadBanks(uid), loadActiveEntries(uid)])
  const creditPurchases = groups
    .flatMap((group) => group.entries)
    .filter((entry) => entry.type === 'PURCHASE' && entry.paymentMethod === 'CREDIT')

  return banks.flatMap((bank) =>
    bank.cards.map((card) => {
      const cardPurchases = creditPurchases.filter((entry) => entry.bankId === bank.id && entry.cardId === card.id)
      const rawAvailable = availableCardLimit(card.limit, cardPurchases, card.usedAmount)
      return {
        cardLabel: card.label,
        bankName: bank.name,
        colorSourceId: card.id,
        used: Math.max(card.limit - rawAvailable, 0),
        available: Math.max(rawAvailable, 0),
        closingDay: card.closingDay,
        dueDay: card.dueDay,
      }
    }),
  )
}
