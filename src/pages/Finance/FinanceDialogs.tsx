import { useState, type FormEvent } from 'react'
import Modal from '../../components/Modal/Modal'
import { newCard } from '../../lib/finance'
import type { Card } from '../../lib/dinluxData'

const BRANDS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outro']
const OTHER = 'Outro'

export function formatDecimal(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

function parseDecimal(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) ? value : null
}

type CardForm = {
  brand: string
  otherBrand: string
  limit: string
  closingDay: string
  dueDay: string
  hasInterest: boolean
  interestRate: string
}

function emptyCardForm(): CardForm {
  return { brand: BRANDS[0], otherBrand: '', limit: '', closingDay: '', dueDay: '', hasInterest: false, interestRate: '' }
}

function cardFormFrom(card: Card): CardForm {
  const known = BRANDS.slice(0, -1).find((brand) => card.label.startsWith(brand))
  return {
    brand: known ?? OTHER,
    otherBrand: known ? '' : card.label,
    limit: formatDecimal(card.limit),
    closingDay: String(card.closingDay),
    dueDay: String(card.dueDay),
    hasInterest: card.hasInterest,
    interestRate: card.hasInterest ? formatDecimal(card.interestRate) : '',
  }
}

type ParsedCard = {
  brand: string
  limit: number
  closingDay: number
  dueDay: number
  hasInterest: boolean
  interestRate: number
}

function parseCardForm(form: CardForm, label?: string): ParsedCard | string {
  const brand = form.brand === OTHER ? form.otherBrand.trim() : form.brand
  if (!brand) return 'Digite o nome da bandeira do cartão'

  const limit = parseDecimal(form.limit)
  const closingDay = Number(form.closingDay)
  const dueDay = Number(form.dueDay)
  const validDay = (day: number) => Number.isInteger(day) && day >= 1 && day <= 31
  if (limit === null || !validDay(closingDay) || !validDay(dueDay)) {
    return `Preencha corretamente todos os campos do cartão${label ? ` ${label}` : ''}`
  }

  const interestRate = form.hasInterest ? parseDecimal(form.interestRate) : 0
  if (form.hasInterest && (interestRate === null || interestRate <= 0)) {
    return `Informe a taxa de juros do cartão${label ? ` ${label}` : ''}`
  }

  return { brand, limit, closingDay, dueDay, hasInterest: form.hasInterest, interestRate: interestRate ?? 0 }
}

function cardLabel(cards: Card[], brand: string, excludingId?: string): string {
  const sameBrand = cards.filter((card) => card.label.startsWith(brand) && card.id !== excludingId).length
  return sameBrand > 0 ? `${brand} ${sameBrand + 1}` : brand
}

function useAction(onDone: () => void) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
      setBusy(false)
    }
  }

  return { error, busy, run, setError }
}

function CardFields({ form, onChange }: { form: CardForm; onChange: (form: CardForm) => void }) {
  function set<K extends keyof CardForm>(key: K, value: CardForm[K]) {
    onChange({ ...form, [key]: value })
  }

  return (
    <>
      <label>
        Bandeira
        <select value={form.brand} onChange={(event) => set('brand', event.target.value)}>
          {BRANDS.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </select>
      </label>
      {form.brand === OTHER && (
        <label>
          Digite a bandeira do cartão
          <input type="text" value={form.otherBrand} onChange={(event) => set('otherBrand', event.target.value)} />
        </label>
      )}
      <label>
        Limite
        <input type="text" inputMode="decimal" value={form.limit} onChange={(event) => set('limit', event.target.value)} />
      </label>
      <div className="finance-form-row">
        <label>
          Dia fechamento (1-31)
          <input
            type="text"
            inputMode="numeric"
            value={form.closingDay}
            onChange={(event) => set('closingDay', event.target.value)}
          />
        </label>
        <label>
          Dia vencimento (1-31)
          <input type="text" inputMode="numeric" value={form.dueDay} onChange={(event) => set('dueDay', event.target.value)} />
        </label>
      </div>
      <label className="auth-form-checkbox">
        <input type="checkbox" checked={form.hasInterest} onChange={(event) => set('hasInterest', event.target.checked)} />
        Cobra juros no parcelamento?
      </label>
      {form.hasInterest && (
        <label>
          Taxa de juros mensal (%) — ex: 2,5
          <input
            type="text"
            inputMode="decimal"
            value={form.interestRate}
            onChange={(event) => set('interestRate', event.target.value)}
          />
        </label>
      )}
    </>
  )
}

export function BankFormDialog({
  onClose,
  onSave,
}: {
  onClose: () => void
  onSave: (name: string, debit: number, cards: Card[]) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [debit, setDebit] = useState('')
  const [rows, setRows] = useState<CardForm[]>([])
  const { error, busy, run, setError } = useAction(onClose)

  function updateRow(index: number, form: CardForm) {
    setRows((current) => current.map((row, position) => (position === index ? form : row)))
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Informe o nome do banco')
    const debitValue = parseDecimal(debit)
    if (debitValue === null) return setError('Informe um saldo válido')

    const cards: Card[] = []
    const counters = new Map<string, number>()
    for (const row of rows) {
      if (!row.limit.trim() && !row.closingDay.trim() && !row.dueDay.trim()) continue
      const brand = row.brand === OTHER ? row.otherBrand.trim() : row.brand
      const parsed = parseCardForm(row, brand)
      if (typeof parsed === 'string') return setError(parsed)
      const count = (counters.get(parsed.brand) ?? 0) + 1
      counters.set(parsed.brand, count)
      cards.push(
        newCard({
          label: count > 1 ? `${parsed.brand} ${count}` : parsed.brand,
          limit: parsed.limit,
          closingDay: parsed.closingDay,
          dueDay: parsed.dueDay,
          hasInterest: parsed.hasInterest,
          interestRate: parsed.interestRate,
        }),
      )
    }
    run(() => onSave(name.trim(), debitValue, cards))
  }

  return (
    <Modal title="Novo Banco" onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Nome do banco
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Saldo atual
          <input type="text" inputMode="decimal" value={debit} onChange={(event) => setDebit(event.target.value)} />
        </label>

        {rows.map((row, index) => (
          <fieldset key={index} className="finance-card-fieldset">
            <legend>Cartão {index + 1}</legend>
            <CardFields form={row} onChange={(form) => updateRow(index, form)} />
            <button
              type="button"
              className="auth-form-link"
              onClick={() => setRows((current) => current.filter((_, position) => position !== index))}
            >
              Remover cartão
            </button>
          </fieldset>
        ))}
        <button type="button" className="auth-form-link" onClick={() => setRows((current) => [...current, emptyCardForm()])}>
          + Adicionar cartão de crédito
        </button>

        {error && <p className="auth-form-error">{error}</p>}
        <button type="submit" className="auth-form-submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar banco'}
        </button>
      </form>
    </Modal>
  )
}

export function CardFormDialog({
  card,
  cards,
  onClose,
  onSave,
}: {
  card?: Card
  cards: Card[]
  onClose: () => void
  onSave: (cards: Card[]) => Promise<void>
}) {
  const [form, setForm] = useState<CardForm>(card ? cardFormFrom(card) : emptyCardForm())
  const { error, busy, run, setError } = useAction(onClose)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseCardForm(form)
    if (typeof parsed === 'string') return setError(parsed)

    const label = cardLabel(cards, parsed.brand, card?.id)
    const fields = {
      label,
      limit: parsed.limit,
      closingDay: parsed.closingDay,
      dueDay: parsed.dueDay,
      hasInterest: parsed.hasInterest,
      interestRate: parsed.interestRate,
    }
    const updated = card
      ? cards.map((existing) => (existing.id === card.id ? { ...existing, ...fields } : existing))
      : [...cards, newCard(fields)]
    run(() => onSave(updated))
  }

  return (
    <Modal title={card ? 'Editar Cartão' : 'Novo Cartão'} onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <CardFields form={form} onChange={setForm} />
        {error && <p className="auth-form-error">{error}</p>}
        <button type="submit" className="auth-form-submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar cartão'}
        </button>
      </form>
    </Modal>
  )
}

export function ValueDialog({
  title,
  label,
  initial,
  onClose,
  onSave,
}: {
  title: string
  label: string
  initial: number
  onClose: () => void
  onSave: (value: number) => Promise<void>
}) {
  const [text, setText] = useState(formatDecimal(initial))
  const { error, busy, run, setError } = useAction(onClose)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = parseDecimal(text)
    if (value === null) return setError('Informe um valor válido.')
    run(() => onSave(value))
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          {label}
          <input type="text" inputMode="decimal" value={text} onChange={(event) => setText(event.target.value)} autoFocus />
        </label>
        {error && <p className="auth-form-error">{error}</p>}
        <button type="submit" className="auth-form-submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </Modal>
  )
}

export function TextDialog({
  title,
  label,
  initial,
  onClose,
  onSave,
}: {
  title: string
  label: string
  initial: string
  onClose: () => void
  onSave: (value: string) => Promise<void>
}) {
  const [text, setText] = useState(initial)
  const { error, busy, run, setError } = useAction(onClose)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = text.trim()
    if (!value) return setError('Informe um nome válido')
    run(() => onSave(value))
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          {label}
          <input type="text" value={text} onChange={(event) => setText(event.target.value)} autoFocus />
        </label>
        {error && <p className="auth-form-error">{error}</p>}
        <button type="submit" className="auth-form-submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </Modal>
  )
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string
  message: string
  confirmLabel: string
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const { error, busy, run } = useAction(onClose)

  return (
    <Modal title={title} onClose={onClose}>
      <div className="auth-form">
        <p className="settings-current">{message}</p>
        {error && <p className="auth-form-error">{error}</p>}
        <button type="button" className="auth-form-submit settings-danger" disabled={busy} onClick={() => run(onConfirm)}>
          {busy ? 'Aguarde…' : confirmLabel}
        </button>
        <button type="button" className="auth-form-link" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </Modal>
  )
}
