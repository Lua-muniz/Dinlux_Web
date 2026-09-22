import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../components/Charts/Charts'
import { loadBanks, loadListItems, loadLists, type Bank, type ShoppingList, type ShoppingListItem } from '../../lib/dinluxData'
import { addItem, createList, deleteList, deleteItem, renameList, setItemDone, updateItem } from '../../lib/lists'
import { updateBankDebit, saveCards } from '../../lib/finance'
import { ConfirmDialog, TextDialog } from '../Finance/FinanceDialogs'
import { ItemFormDialog, LaunchDialog } from './ListasDialogs'
import DropdownMenu, { type DropdownMenuItem } from '../../components/DropdownMenu/DropdownMenu'
import './Listas.css'

type Dialog = 'newList' | 'renameList' | 'deleteList' | 'newItem' | 'editItem' | 'deleteItem' | 'launch'

const DOTS = 'M5 12h.01M12 12h.01M19 12h.01'
const PLUS = 'M12 5v14M5 12h14'

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export default function Listas() {
  const { user } = useAuth()
  const uid = user?.uid
  const [lists, setLists] = useState<ShoppingList[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [items, setItems] = useState<ShoppingListItem[] | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [activeItem, setActiveItem] = useState<ShoppingListItem | null>(null)

  const reloadLists = useCallback(async () => {
    if (!uid) return
    try {
      const [loadedLists, loadedBanks] = await Promise.all([loadLists(uid), loadBanks(uid)])
      setLists(loadedLists)
      setBanks(loadedBanks)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [uid])

  useEffect(() => {
    reloadLists()
  }, [reloadLists])

  useEffect(() => {
    if (lists.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !lists.some((list) => list.id === selectedId)) {
      setSelectedId(lists[0].id)
    }
  }, [lists, selectedId])

  const reloadItems = useCallback(async () => {
    if (!uid || !selectedId) {
      setItems(null)
      return
    }
    try {
      setItems(await loadListItems(uid, selectedId))
    } catch {
      setItems(null)
    }
  }, [uid, selectedId])

  useEffect(() => {
    reloadItems()
  }, [reloadItems])

  if (status === 'loading') return <p className="home-status">Carregando…</p>
  if (status === 'error') return <p className="home-status">Não foi possível carregar os dados.</p>
  if (!uid) return null

  function closeDialog() {
    setDialog(null)
    setActiveItem(null)
  }

  const selectedList = lists.find((list) => list.id === selectedId) ?? null

  const itemCount = items?.length ?? 0
  const doneCount = items?.filter((item) => item.done).length ?? 0
  const pricedItems = items?.filter((item) => item.price != null) ?? []
  const subtotal = (item: ShoppingListItem) => (item.price ?? 0) * (item.quantity ?? 1)
  const total = pricedItems.reduce((sum, item) => sum + subtotal(item), 0)
  const spent = pricedItems.filter((item) => item.done).reduce((sum, item) => sum + subtotal(item), 0)
  const hasPricedDoneItems = pricedItems.some((item) => item.done)

  const listMenu = (list: ShoppingList): DropdownMenuItem[] => [
    { label: 'Lançar', onSelect: () => { setSelectedId(list.id); setDialog('launch') } },
    { label: 'Renomear', onSelect: () => { setSelectedId(list.id); setDialog('renameList') } },
    { label: 'Excluir', danger: true, onSelect: () => { setSelectedId(list.id); setDialog('deleteList') } },
  ]

  return (
    <div className="listas">
      <section className="home-card listas-sidebar">
        <div className="listas-sidebar-header">
          <strong>Listas</strong>
          <button type="button" className="panel-exit listas-new-btn" onClick={() => setDialog('newList')}>
            Nova
          </button>
        </div>

        {lists.length === 0 ? (
          <p className="finance-empty-text">Nenhuma lista criada.</p>
        ) : (
          <div className="listas-list-rows">
            {lists.map((list) => (
              <div
                key={list.id}
                className={`listas-list-row ${list.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(list.id)}
              >
                <span className="listas-list-title">{list.title}</span>
                <DropdownMenu label={`Opções de ${list.title}`} icon={DOTS} items={listMenu(list)} align="left" />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="home-card listas-main">
        {!selectedList ? (
          <div className="finance-empty">
            <p>Crie uma lista para começar.</p>
            <button type="button" className="auth-form-submit" onClick={() => setDialog('newList')}>
              Criar Lista
            </button>
          </div>
        ) : (
          <>
            <div className="listas-main-header">
              <div className="listas-summary">
                <span className="listas-summary-item">Itens: {doneCount}/{itemCount}</span>
                {pricedItems.length > 0 && (
                  <>
                    <span className="listas-summary-item">Total: {formatCurrency(total)}</span>
                    <span className="listas-summary-item">Feito: {formatCurrency(spent)}</span>
                    <span className="listas-summary-item">Falta: {formatCurrency(total - spent)}</span>
                  </>
                )}
              </div>
              <button
                type="button"
                className="finance-icon-button listas-add-button"
                aria-label="Novo item"
                onClick={() => setDialog('newItem')}
              >
                <Icon d={PLUS} />
              </button>
            </div>

            {items === null ? (
              <p className="finance-empty-text">Carregando itens…</p>
            ) : items.length === 0 ? (
              <p className="finance-empty-text">Nenhum item nessa lista ainda.</p>
            ) : (
              <div className="listas-items">
                {items.map((item) => (
                  <div key={item.id} className={`listas-item-row ${item.done ? 'done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={async (event) => {
                        const done = event.target.checked
                        setItems((current) => current?.map((it) => (it.id === item.id ? { ...it, done } : it)) ?? null)
                        try {
                          await setItemDone(uid, item.id, done)
                        } catch {
                          await reloadItems()
                        }
                      }}
                    />
                    <div className="listas-item-info">
                      <span className="listas-item-name">{item.name}</span>
                      <span className="listas-item-details">
                        {item.quantity != null && `Qtd: ${item.quantity}`}
                        {item.quantity != null && item.price != null && ' · '}
                        {item.price != null && formatCurrency(subtotal(item))}
                      </span>
                    </div>
                    <DropdownMenu
                      label={`Opções de ${item.name}`}
                      icon={DOTS}
                      align="right"
                      items={[
                        { label: 'Editar', onSelect: () => { setActiveItem(item); setDialog('editItem') } },
                        { label: 'Excluir', danger: true, onSelect: () => { setActiveItem(item); setDialog('deleteItem') } },
                      ]}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {dialog === 'newList' && (
        <TextDialog
          title="Nova lista"
          label="Nome da lista"
          initial=""
          onClose={closeDialog}
          onSave={async (title) => {
            await createList(uid, title)
            await reloadLists()
          }}
        />
      )}

      {selectedList && dialog === 'renameList' && (
        <TextDialog
          title="Renomear lista"
          label="Nome da lista"
          initial={selectedList.title}
          onClose={closeDialog}
          onSave={async (title) => {
            await renameList(uid, selectedList.id, title)
            await reloadLists()
          }}
        />
      )}

      {selectedList && dialog === 'deleteList' && (
        <ConfirmDialog
          title="Excluir lista"
          message={`Tem certeza que deseja excluir "${selectedList.title}"? Essa ação não pode ser desfeita e apaga todos os itens dessa lista.`}
          confirmLabel="Excluir"
          onClose={closeDialog}
          onConfirm={async () => {
            await deleteList(uid, selectedList.id)
            setSelectedId(null)
            await reloadLists()
          }}
        />
      )}

      {selectedList && dialog === 'newItem' && (
        <ItemFormDialog
          onClose={closeDialog}
          onSave={async (name, quantity, price) => {
            await addItem(uid, selectedList.id, name, quantity, price)
            await reloadItems()
          }}
        />
      )}

      {activeItem && dialog === 'editItem' && (
        <ItemFormDialog
          item={activeItem}
          onClose={closeDialog}
          onSave={async (name, quantity, price) => {
            await updateItem(uid, activeItem.id, name, quantity, price)
            await reloadItems()
          }}
        />
      )}

      {activeItem && dialog === 'deleteItem' && (
        <ConfirmDialog
          title="Excluir item"
          message={`Tem certeza que deseja excluir "${activeItem.name}"?`}
          confirmLabel="Excluir"
          onClose={closeDialog}
          onConfirm={async () => {
            await deleteItem(uid, activeItem.id)
            await reloadItems()
          }}
        />
      )}

      {selectedList && dialog === 'launch' && (
        <LaunchDialog
          banks={banks}
          total={spent}
          onClose={closeDialog}
          onLaunch={async (bankId, cardId) => {
            if (!hasPricedDoneItems) throw new Error('Não há itens marcados e com preço para lançar.')
            const bank = banks.find((item) => item.id === bankId)
            if (!bank) throw new Error('Banco não encontrado.')
            if (!cardId) {
              await updateBankDebit(uid, bankId, bank.debit - spent)
            } else {
              const updatedCards = bank.cards.map((card) =>
                card.id === cardId ? { ...card, usedAmount: card.usedAmount + spent } : card,
              )
              await saveCards(uid, bankId, updatedCards)
            }
            await reloadLists()
          }}
        />
      )}
    </div>
  )
}
