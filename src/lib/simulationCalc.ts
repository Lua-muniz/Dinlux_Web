import type { SimulationEntry } from './dinluxData'

export type Period = { key: number; paid: boolean }

function monthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth()
}

function monthStartMillis(index: number): number {
  return new Date(Math.floor(index / 12), index % 12, 1).getTime()
}

function daysInMonth(index: number): number {
  return new Date(Math.floor(index / 12), (index % 12) + 1, 0).getDate()
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function unpaidInstallments(total: number, paid: number): number {
  return Math.max(total - paid, 0)
}

export function unpaidInstallmentsValue(installmentValue: number, total: number, paid: number): number {
  return installmentValue * unpaidInstallments(total, paid)
}

export function availableCardLimit(
  totalLimit: number,
  creditPurchases: SimulationEntry[],
  usedAmount: number,
): number {
  const used = creditPurchases.reduce(
    (sum, entry) => sum + unpaidInstallmentsValue(entry.installmentValue, entry.installments, entry.paidInstallments),
    0,
  )
  return totalLimit - used - usedAmount
}

function purchaseStartMonth(createdAt: number, method: 'DEBIT' | 'CREDIT', closingDay: number): number {
  const created = new Date(createdAt)
  const createdMonth = monthIndex(created)
  if (method === 'DEBIT' || closingDay <= 0) return createdMonth
  return created.getDate() <= closingDay ? createdMonth : createdMonth + 1
}

export function savingsPeriods(entry: SimulationEntry, today: Date): Period[] {
  const start = monthIndex(new Date(entry.startDate))
  const end = monthIndex(new Date(entry.endDate))
  const current = monthIndex(today)
  const confirmed = new Set(entry.confirmedPeriods)

  const periods: Period[] = []
  for (let month = start; month <= end; month++) {
    const key = monthStartMillis(month)
    const paid = confirmed.has(key)
    if (paid || month <= current) {
      periods.push({ key, paid })
    } else {
      break
    }
  }
  return periods
}

export function purchaseCycles(entry: SimulationEntry, dueDay: number, today: Date): Period[] {
  if (dueDay <= 0 || entry.installments <= 0) return []
  const start = purchaseStartMonth(entry.createdAt, entry.paymentMethod ?? 'CREDIT', entry.cardClosingDay)
  const confirmed = new Set(entry.confirmedPeriods)
  const todayStart = startOfDay(today)

  const cycles: Period[] = []
  for (let index = 0; index < entry.installments; index++) {
    const month = start + index
    const day = Math.min(Math.max(dueDay, 1), daysInMonth(month))
    const due = new Date(Math.floor(month / 12), month % 12, day).getTime()
    const key = monthStartMillis(month)
    const paid = confirmed.has(key)
    if (paid || due <= todayStart) {
      cycles.push({ key, paid })
    } else {
      break
    }
  }
  return cycles
}

export function unseenAlertsCount(entry: SimulationEntry, periods: Period[]): number {
  const lastSeen = entry.ultimoPeriodoVisto > 0 ? monthIndex(new Date(entry.ultimoPeriodoVisto)) : null
  return periods.filter(
    (period) => !period.paid && (lastSeen === null || monthIndex(new Date(period.key)) > lastSeen),
  ).length
}
