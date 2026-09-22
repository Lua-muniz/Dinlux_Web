import { useMemo, useState, type FormEvent } from 'react'
import Modal from '../../components/Modal/Modal'
import { formatCurrency } from '../../components/Charts/Charts'
import type { Bank, SimulationEntry } from '../../lib/dinluxData'
import {
  installmentValue,
  monthLabel,
  monthsBetween,
  monthlySavingsAmount,
  purchaseEndMonthIndex,
  purchaseStartMonthIndex,
  totalWithInterest,
  availableCardLimit,
} from '../../lib/simulationCalc'
import type { NewEntry } from '../../lib/simulations'

function parseDecimal(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) ? value : null
}

function useAction() {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setBusy(false)
    }
  }

  return { error, busy, run, setError }
}

export function CreateEntryDialog({
  simulationId,
  type,
  banks,
  activeCreditPurchases,
  onClose,
  onSave,
}: {
  simulationId: string
  type: 'PURCHASE' | 'SAVINGS'
  banks: Bank[]
  activeCreditPurchases: SimulationEntry[]
  onClose: () => void
  onSave: (entry: NewEntry) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [bankId, setBankId] = useState(banks[0]?.id ?? '')
  const bank = banks.find((item) => item.id === bankId)

  const [method, setMethod] = useState<'DEBIT' | 'CREDIT'>('DEBIT')
  const [cardId, setCardId] = useState(bank?.cards[0]?.id ?? '')
  const card = bank?.cards.find((item) => item.id === cardId)
  const [value, setValue] = useState('')
  const [installments, setInstallments] = useState('1')

  const [target, setTarget] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const [confirmMessage, setConfirmMessage] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const { error, busy, run, setError } = useAction()

  function selectBank(id: string) {
    setBankId(id)
    const newBank = banks.find((item) => item.id === id)
    setCardId(newBank?.cards[0]?.id ?? '')
  }

  const purchasePreview = useMemo(() => {
    if (type !== 'PURCHASE') return ''
    const totalValue = parseDecimal(value)
    if (totalValue === null || totalValue <= 0) return ''
    const count = Math.max(Number(installments) || 1, 1)
    const rate = method === 'CREDIT' && count > 1 && card?.hasInterest ? card.interestRate : 0
    const perInstallment = installmentValue(totalValue, count, rate)
    const total = totalWithInterest(perInstallment, count)
    if (count <= 1) return `1x de ${formatCurrency(perInstallment)} (à vista)`
    if (rate > 0) return `${count}x de ${formatCurrency(perInstallment)} — total com juros: ${formatCurrency(total)}`
    return `${count}x de ${formatCurrency(perInstallment)} (sem juros)`
  }, [type, value, installments, method, card])

  const savingsPreview = useMemo(() => {
    if (type !== 'SAVINGS') return ''
    const targetValue = parseDecimal(target)
    if (targetValue === null || targetValue <= 0 || !start || !end) return ''
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (endDate <= startDate) return ''
    const months = monthsBetween(startDate, endDate)
    const monthly = monthlySavingsAmount(targetValue, startDate, endDate)
    return `${formatCurrency(monthly)} por mês, durante ${months} ${months === 1 ? 'mês' : 'meses'}.`
  }, [type, target, start, end])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) return setError('Informe um nome para o lançamento')
    if (!bank) return setError('Selecione um banco')

    if (type === 'PURCHASE') {
      const totalValue = parseDecimal(value)
      if (totalValue === null || totalValue <= 0) return setError('Informe um valor total válido')
      const count = Number(installments)
      if (!Number.isInteger(count) || count <= 0) return setError('Informe um número de parcelas válido')

      if (method === 'CREDIT') {
        if (!card) return setError('Selecione um cartão')
        const rate = count > 1 && card.hasInterest ? card.interestRate : 0
        const perInstallment = installmentValue(totalValue, count, rate)
        const total = totalWithInterest(perInstallment, count)
        const cardPurchases = activeCreditPurchases.filter((entry) => entry.bankId === bank.id && entry.cardId === card.id)
        const available = availableCardLimit(card.limit, cardPurchases, card.usedAmount)
        if (total > available) {
          return setError(
            `Essa compra (${formatCurrency(total)} no total) ultrapassa o limite disponível do cartão ${card.label} (${formatCurrency(Math.max(available, 0))}). Reduza o valor ou o número de parcelas, ou escolha outro cartão.`,
          )
        }
        const entry: NewEntry = {
          simulationId,
          type: 'PURCHASE',
          title: trimmedTitle,
          paymentMethod: 'CREDIT',
          bankId: bank.id,
          bankName: bank.name,
          cardId: card.id,
          cardLabel: card.label,
          cardClosingDay: card.closingDay,
          totalValue,
          installments: count,
          installmentValue: perInstallment,
          paidInstallments: 0,
          targetValue: 0,
          startDate: 0,
          endDate: 0,
          monthlyAmount: 0,
          savedAmount: 0,
        }
        run(() => onSave(entry))
        return
      }

      const perInstallment = installmentValue(totalValue, count, 0)
      const entry: NewEntry = {
        simulationId,
        type: 'PURCHASE',
        title: trimmedTitle,
        paymentMethod: 'DEBIT',
        bankId: bank.id,
        bankName: bank.name,
        cardId: '',
        cardLabel: '',
        cardClosingDay: 0,
        totalValue,
        installments: count,
        installmentValue: perInstallment,
        paidInstallments: 0,
        targetValue: 0,
        startDate: 0,
        endDate: 0,
        monthlyAmount: 0,
        savedAmount: 0,
      }
      const proceed = () => run(() => onSave(entry))
      if (perInstallment > bank.debit) {
        setConfirmMessage({
          message: `A primeira parcela (${formatCurrency(perInstallment)}) ultrapassa o saldo atual de ${bank.name} (${formatCurrency(bank.debit)}). Continuar mesmo assim?`,
          onConfirm: proceed,
        })
      } else {
        proceed()
      }
      return
    }

    const targetValue = parseDecimal(target)
    if (targetValue === null || targetValue <= 0) return setError('Informe um valor de meta válido')
    if (!start || !end) return setError('Escolha a data de início e de fim')
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (endDate <= startDate) return setError('A data de fim precisa ser depois da data de início')

    const monthly = monthlySavingsAmount(targetValue, startDate, endDate)
    const entry: NewEntry = {
      simulationId,
      type: 'SAVINGS',
      title: trimmedTitle,
      paymentMethod: 'DEBIT',
      bankId: bank.id,
      bankName: bank.name,
      cardId: '',
      cardLabel: '',
      cardClosingDay: 0,
      totalValue: 0,
      installments: 1,
      installmentValue: 0,
      paidInstallments: 0,
      targetValue,
      startDate: startDate.getTime(),
      endDate: endDate.getTime(),
      monthlyAmount: monthly,
      savedAmount: 0,
    }
    const proceed = () => run(() => onSave(entry))
    if (monthly > bank.debit) {
      setConfirmMessage({
        message: `O valor mensal calculado (${formatCurrency(monthly)}) ultrapassa o saldo atual de ${bank.name} (${formatCurrency(bank.debit)}). Continuar mesmo assim?`,
        onConfirm: proceed,
      })
    } else {
      proceed()
    }
  }

  if (confirmMessage) {
    return (
      <Modal title="Aviso" onClose={onClose}>
        <div className="auth-form">
          <p className="settings-current">{confirmMessage.message}</p>
          {error && <p className="auth-form-error">{error}</p>}
          <button type="button" className="auth-form-submit" disabled={busy} onClick={confirmMessage.onConfirm}>
            {busy ? 'Salvando…' : 'Continuar mesmo assim'}
          </button>
          <button type="button" className="auth-form-link" onClick={() => setConfirmMessage(null)}>
            Cancelar
          </button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal title={type === 'PURCHASE' ? 'Nova Compra' : 'Nova Economia'} onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Nome
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </label>

        {type === 'PURCHASE' ? (
          <>
            <label>
              Valor total
              <input type="text" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
            </label>
            <label>
              Banco
              <select value={bankId} onChange={(event) => selectBank(event.target.value)}>
                {banks.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="auth-form-checkbox" style={{ gap: 16 }}>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <input type="radio" checked={method === 'DEBIT'} onChange={() => setMethod('DEBIT')} /> Débito
              </label>
              <label style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <input type="radio" checked={method === 'CREDIT'} onChange={() => setMethod('CREDIT')} /> Crédito
              </label>
            </div>
            {method === 'CREDIT' && (
              <>
                <label>
                  Cartão
                  <select value={cardId} onChange={(event) => setCardId(event.target.value)}>
                    {(bank?.cards ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="settings-current">
                  {card?.hasInterest
                    ? `Este cartão cobra ${card.interestRate}% de juros ao mês (a partir de 2 parcelas).`
                    : 'Este cartão não cobra juros no parcelamento.'}
                </p>
              </>
            )}
            <label>
              Parcelas
              <input type="text" inputMode="numeric" value={installments} onChange={(event) => setInstallments(event.target.value)} />
            </label>
            {purchasePreview && <p className="settings-current">{purchasePreview}</p>}
          </>
        ) : (
          <>
            <label>
              Meta (R$)
              <input type="text" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
            </label>
            <label>
              Banco
              <select value={bankId} onChange={(event) => selectBank(event.target.value)}>
                {banks.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="finance-form-row">
              <label>
                Data de início
                <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
              </label>
              <label>
                Data de fim
                <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
              </label>
            </div>
            {savingsPreview && <p className="settings-current">{savingsPreview}</p>}
          </>
        )}

        {error && <p className="auth-form-error">{error}</p>}
        <button type="submit" className="auth-form-submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar lançamento'}
        </button>
      </form>
    </Modal>
  )
}

function purchaseInfo(entry: SimulationEntry, bankName: string): string {
  const method = entry.paymentMethod === 'CREDIT' ? `Crédito — ${entry.cardLabel}` : `Débito — ${bankName}`
  const startMonth = purchaseStartMonthIndex(entry.createdAt, entry.paymentMethod ?? 'DEBIT', entry.cardClosingDay)
  const endMonth = purchaseEndMonthIndex(startMonth, entry.installments)
  const bankLine = entry.paymentMethod === 'CREDIT' ? `Banco: ${bankName}\n` : ''
  return (
    `Valor total: ${formatCurrency(entry.totalValue)}\n` +
    `Forma: ${method}\n` +
    bankLine +
    `Parcelas: ${entry.installments}x de ${formatCurrency(entry.installmentValue)}\n` +
    `Total com juros: ${formatCurrency(totalWithInterest(entry.installmentValue, entry.installments))}\n` +
    `Início: ${monthLabel(startMonth)}\n` +
    `Fim: ${monthLabel(endMonth)}`
  )
}

function savingsInfo(entry: SimulationEntry, bankName: string): string {
  const dateFormat = new Intl.DateTimeFormat('pt-BR')
  return (
    `Meta: ${formatCurrency(entry.targetValue)}\n` +
    `Valor mensal: ${formatCurrency(entry.monthlyAmount)}\n` +
    `Banco: ${bankName}\n` +
    `Início: ${dateFormat.format(new Date(entry.startDate))}\n` +
    `Fim: ${dateFormat.format(new Date(entry.endDate))}`
  )
}

function progressOf(entry: SimulationEntry, active: boolean): { label: string; percent: number } | null {
  if (!active) return null
  if (entry.type === 'SAVINGS') {
    const percent = entry.targetValue > 0 ? Math.min(Math.max(Math.round((entry.savedAmount / entry.targetValue) * 100), 0), 100) : 0
    return { label: `${formatCurrency(entry.savedAmount)} de ${formatCurrency(entry.targetValue)} guardado (${percent}%)`, percent }
  }
  if (entry.type === 'PURCHASE' && entry.paymentMethod === 'CREDIT') {
    const percent = entry.installments > 0 ? Math.min(Math.max(Math.round((entry.paidInstallments / entry.installments) * 100), 0), 100) : 0
    return { label: `${entry.paidInstallments} de ${entry.installments} parcelas pagas (${percent}%)`, percent }
  }
  return null
}

export function NodeDetailsDialog({
  entry,
  bankName,
  simulationActive,
  onClose,
  onEdit,
  onDelete,
}: {
  entry: SimulationEntry
  bankName: string
  simulationActive: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const info = entry.type === 'SAVINGS' ? savingsInfo(entry, bankName) : purchaseInfo(entry, bankName)
  const progress = progressOf(entry, simulationActive)

  return (
    <Modal title={entry.title} onClose={onClose}>
      <div className="auth-form">
        {info.split('\n').map((line, index) => (
          <p key={index} className="settings-current" style={{ margin: 0 }}>
            {line}
          </p>
        ))}
        {progress && (
          <div className="sim-progress">
            <p className="settings-current">{progress.label}</p>
            <div className="sim-progress-track">
              <div className="sim-progress-fill" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        )}
        <button type="button" className="auth-form-submit" onClick={onClose}>
          Fechar
        </button>
        <div className="sim-dialog-actions">
          <button type="button" className="auth-form-link" onClick={onEdit}>
            Editar
          </button>
          <button type="button" className="auth-form-link" style={{ color: 'var(--color-alert-red)' }} onClick={onDelete}>
            Excluir
          </button>
        </div>
      </div>
    </Modal>
  )
}

export function EditPurchaseTitleDialog({
  entry,
  onClose,
  onSave,
}: {
  entry: SimulationEntry
  onClose: () => void
  onSave: (title: string) => Promise<void>
}) {
  const [title, setTitle] = useState(entry.title)
  const { error, busy, run, setError } = useAction()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return setError('Informe um nome')
    run(async () => {
      await onSave(trimmed)
      onClose()
    })
  }

  return (
    <Modal title="Renomear lançamento" onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Nome
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
        </label>
        {error && <p className="auth-form-error">{error}</p>}
        <button type="submit" className="auth-form-submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </Modal>
  )
}

export function EditSavingsDialog({
  entry,
  onClose,
  onSave,
}: {
  entry: SimulationEntry
  onClose: () => void
  onSave: (title: string, target: number, start: number, end: number) => Promise<void>
}) {
  const [title, setTitle] = useState(entry.title)
  const [target, setTarget] = useState(String(entry.targetValue).replace('.', ','))
  const [start, setStart] = useState(new Date(entry.startDate).toISOString().slice(0, 10))
  const [end, setEnd] = useState(new Date(entry.endDate).toISOString().slice(0, 10))
  const { error, busy, run, setError } = useAction()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return setError('Informe um nome')
    const targetValue = parseDecimal(target)
    if (targetValue === null || targetValue <= 0) return setError('Informe um valor de meta válido')
    const startDate = new Date(start)
    const endDate = new Date(end)
    if (endDate <= startDate) return setError('A data de fim precisa ser depois da data de início')
    run(async () => {
      await onSave(trimmed, targetValue, startDate.getTime(), endDate.getTime())
      onClose()
    })
  }

  return (
    <Modal title="Editar economia" onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Nome
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label>
          Meta (R$)
          <input type="text" inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} />
        </label>
        <div className="finance-form-row">
          <label>
            Data de início
            <input type="date" value={start} onChange={(event) => setStart(event.target.value)} />
          </label>
          <label>
            Data de fim
            <input type="date" value={end} onChange={(event) => setEnd(event.target.value)} />
          </label>
        </div>
        {error && <p className="auth-form-error">{error}</p>}
        <button type="submit" className="auth-form-submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </Modal>
  )
}
