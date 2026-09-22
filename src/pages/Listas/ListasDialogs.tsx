import { useState, type FormEvent } from 'react'
import Modal from '../../components/Modal/Modal'
import { formatDecimal } from '../Finance/FinanceDialogs'
import type { Bank, ShoppingListItem } from '../../lib/dinluxData'

function parseDecimal(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) ? value : null
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

export function ItemFormDialog({
  item,
  onClose,
  onSave,
}: {
  item?: ShoppingListItem
  onClose: () => void
  onSave: (name: string, quantity: number | null, price: number | null) => Promise<void>
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [quantity, setQuantity] = useState(item?.quantity != null ? formatDecimal(item.quantity) : '')
  const [price, setPrice] = useState(item?.price != null ? formatDecimal(item.price) : '')
  const { error, busy, run, setError } = useAction(onClose)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) return setError('Informe o nome do item')

    const quantityValue = quantity.trim() ? parseDecimal(quantity) : null
    if (quantity.trim() && quantityValue === null) return setError('Informe uma quantidade válida')

    const priceValue = price.trim() ? parseDecimal(price) : null
    if (price.trim() && priceValue === null) return setError('Informe um preço válido')

    run(() => onSave(name.trim(), quantityValue, priceValue))
  }

  return (
    <Modal title={item ? 'Editar item' : 'Novo item'} onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Nome do item
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </label>
        <div className="finance-form-row">
          <label>
            Quantidade
            <input type="text" inputMode="decimal" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
          <label>
            Preço unitário
            <input type="text" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
          </label>
        </div>
        {error && <p className="auth-form-error">{error}</p>}
        <button type="submit" className="auth-form-submit" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar item'}
        </button>
      </form>
    </Modal>
  )
}

export function LaunchDialog({
  banks,
  total,
  onClose,
  onLaunch,
}: {
  banks: Bank[]
  total: number
  onClose: () => void
  onLaunch: (bankId: string, cardId: string | null) => Promise<void>
}) {
  const [bankId, setBankId] = useState(banks[0]?.id ?? '')
  const [cardId, setCardId] = useState('')
  const { error, busy, run, setError } = useAction(onClose)

  const bank = banks.find((item) => item.id === bankId)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!bank) return setError('Selecione um banco')

    if (!cardId) {
      if (bank.debit < total) return setError('Saldo insuficiente nesse banco.')
    } else {
      const card = bank.cards.find((item) => item.id === cardId)
      if (!card) return setError('Selecione um cartão válido')
      if (card.limit - card.usedAmount < total) return setError('Limite disponível insuficiente nesse cartão.')
    }

    run(() => onLaunch(bankId, cardId || null))
  }

  return (
    <Modal title="Lançar compra" onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="settings-current">Total a lançar: {formatDecimal(total)}</p>
        <label>
          Banco
          <select
            value={bankId}
            onChange={(event) => {
              setBankId(event.target.value)
              setCardId('')
            }}
          >
            {banks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {bank && (
          <label>
            Forma de pagamento
            <select value={cardId} onChange={(event) => setCardId(event.target.value)}>
              <option value="">Débito (saldo)</option>
              {bank.cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {error && <p className="auth-form-error">{error}</p>}
        <button type="submit" className="auth-form-submit" disabled={busy || !bank}>
          {busy ? 'Lançando…' : 'Lançar'}
        </button>
      </form>
    </Modal>
  )
}
