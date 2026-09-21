import { loadActiveEntries, loadBanks } from './dinluxData'
import { purchaseCycles, savingsPeriods, unseenAlertsCount } from './simulationCalc'

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
