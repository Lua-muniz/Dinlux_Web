import { useState, type FormEvent } from 'react'
import Modal from '../../components/Modal/Modal'
import { formatDecimal } from '../Finance/FinanceDialogs'
import type { ShoppingListItem } from '../../lib/dinluxData'

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
