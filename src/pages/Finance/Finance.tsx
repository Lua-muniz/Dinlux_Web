import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import DropdownMenu, { type DropdownMenuItem } from '../../components/DropdownMenu/DropdownMenu'
import { formatCurrency } from '../../components/Charts/Charts'
import {
  loadActiveEntries,
  loadBanks,
  loadTransactions,
  type Bank,
  type Card,
  type SimulationEntry,
  type StatementTransaction,
} from '../../lib/dinluxData'
import { availableCardLimit } from '../../lib/simulationCalc'
import {
  createBank,
  deleteBank,
  deleteCard,
  deleteStatement,
  renameBank,
  saveCards,
  updateBankDebit,
} from '../../lib/finance'
import { BankFormDialog, CardFormDialog, ConfirmDialog, TextDialog, ValueDialog } from './FinanceDialogs'
import './Finance.css'

type Dialog =
  | 'newBank'
  | 'renameBank'
  | 'balance'
  | 'deleteStatement'
  | 'deleteBank'
  | 'newCard'
  | 'editCard'
  | 'available'
  | 'deleteCard'

const DOTS = 'M5 12h.01M12 12h.01M19 12h.01'
const GEAR =
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'
const ARROW_LEFT = 'M15 5l-7 7 7 7'
const ARROW_RIGHT = 'M9 5l7 7-7 7'

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

function ActionMenu({ label, icon, items }: { label: string; icon: string; items: DropdownMenuItem[] }) {
  return <DropdownMenu label={label} icon={icon} items={items} align="right" />
}

function Stepper({ label, disabled, direction, onClick }: { label: string; disabled: boolean; direction: 'left' | 'right'; onClick: () => void }) {
  return (
    <button type="button" className="finance-icon-button" aria-label={label} disabled={disabled} onClick={onClick}>
      <Icon d={direction === 'left' ? ARROW_LEFT : ARROW_RIGHT} />
    </button>
  )
}

function cyclic(index: number, direction: number, size: number): number {
  return (index + direction + size) % size
}

export default function Finance() {
  const { user } = useAuth()
  const uid = user?.uid
  const [banks, setBanks] = useState<Bank[]>([])
  const [purchases, setPurchases] = useState<SimulationEntry[]>([])
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [bankIndex, setBankIndex] = useState(0)
  const [cardIndex, setCardIndex] = useState(0)
  const [transactions, setTransactions] = useState<StatementTransaction[] | null>(null)
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const reload = useCallback(async () => {
    if (!uid) return
    try {
      const [loadedBanks, groups] = await Promise.all([loadBanks(uid), loadActiveEntries(uid)])
      setBanks(loadedBanks)
      setPurchases(
        groups
          .flatMap((group) => group.entries)
          .filter((entry) => entry.type === 'PURCHASE' && entry.paymentMethod === 'CREDIT'),
      )
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [uid])

  useEffect(() => {
    reload()
  }, [reload])

  const bank: Bank | undefined = banks[bankIndex] ?? banks[0]
  const bankId = bank?.id
  const cards: Card[] = bank?.cards ?? []
  const card: Card | undefined = cards[cardIndex] ?? cards[0]

  useEffect(() => {
    if (!uid || !bankId) return
    let cancelled = false
    loadTransactions(uid, bankId)
      .then((loaded) => {
        if (!cancelled) setTransactions(loaded.sort((a, b) => b.date - a.date))
      })
      .catch(() => {
        if (!cancelled) setTransactions(null)
      })
    return () => {
      cancelled = true
    }
  }, [uid, bankId])

  if (status === 'loading') return <p className="home-status">Carregando…</p>
  if (status === 'error') return <p className="home-status">Não foi possível carregar os dados.</p>
  if (!uid) return null

  function closeDialog() {
    setDialog(null)
  }

  function changeBank(direction: number) {
    setBankIndex(cyclic(bankIndex, direction, banks.length))
    setCardIndex(0)
    setTransactions(null)
  }

  const cardPurchases = card ? purchases.filter((entry) => entry.bankId === bank?.id && entry.cardId === card.id) : []
  const available = card ? availableCardLimit(card.limit, cardPurchases, card.usedAmount) : 0
  const showAvailable = card !== undefined && (cardPurchases.length > 0 || card.usedAmount > 0)

  const bankMenu: DropdownMenuItem[] = [
    { label: 'Renomear', onSelect: () => setDialog('renameBank') },
    { label: 'Criar', onSelect: () => setDialog('newBank') },
    { label: 'Excluir Extrato', onSelect: () => setDialog('deleteStatement') },
    { label: 'Excluir', danger: true, onSelect: () => setDialog('deleteBank') },
  ]

  const cardMenu: DropdownMenuItem[] = card
    ? [
        { label: 'Editar', onSelect: () => setDialog('editCard') },
        { label: 'Criar', onSelect: () => setDialog('newCard') },
        { label: 'Limite Disponível', onSelect: () => setDialog('available') },
        { label: 'Excluir', danger: true, onSelect: () => setDialog('deleteCard') },
      ]
    : [{ label: 'Criar', onSelect: () => setDialog('newCard') }]

  return (
    <div className="finance">
      <div className="finance-top">
        <section className="home-card finance-card">
          <div className="finance-card-header">
            <strong>Banco</strong>
            {bank && <ActionMenu label="Opções do banco" icon={DOTS} items={bankMenu} />}
          </div>

          {bank ? (
            <>
              <div className="finance-carousel">
                <Stepper label="Banco anterior" direction="left" disabled={banks.length < 2} onClick={() => changeBank(-1)} />
                <h2 className="finance-bank-name">{bank.name}</h2>
                <Stepper label="Próximo banco" direction="right" disabled={banks.length < 2} onClick={() => changeBank(1)} />
              </div>
              <div className="finance-balance">
                <span>Saldo</span>
                <button type="button" className="finance-balance-value" onClick={() => setDialog('balance')}>
                  {formatCurrency(bank.debit)}
                </button>
              </div>
            </>
          ) : (
            <div className="finance-empty">
              <p>Nenhum banco cadastrado.</p>
              <button type="button" className="auth-form-submit" onClick={() => setDialog('newBank')}>
                Criar Banco
              </button>
            </div>
          )}
        </section>

        <section className="home-card finance-card finance-card-cyan">
          <div className="finance-card-header">
            <strong>Cartão de crédito</strong>
            {bank && <ActionMenu label="Opções do cartão" icon={GEAR} items={cardMenu} />}
          </div>

          {card ? (
            <div className="finance-carousel">
              <Stepper label="Cartão anterior" direction="left" disabled={cards.length < 2} onClick={() => setCardIndex(cyclic(cardIndex, -1, cards.length))} />
              <div className="finance-card-info">
                <span className="finance-badge">{card.label}</span>
                <span>Limite: {formatCurrency(card.limit)}</span>
                {showAvailable && <span>Limite disponível: {formatCurrency(Math.max(available, 0))}</span>}
                <span>Fechamento: dia {card.closingDay}</span>
                <span>Vencimento: dia {card.dueDay}</span>
                {cards.length > 1 && <span className="finance-counter">{cards.indexOf(card) + 1}/{cards.length}</span>}
              </div>
              <Stepper label="Próximo cartão" direction="right" disabled={cards.length < 2} onClick={() => setCardIndex(cyclic(cardIndex, 1, cards.length))} />
            </div>
          ) : (
            <p className="finance-empty-text">Não há Cartão de Crédito Registrado</p>
          )}
        </section>
      </div>

      {bank && (
        <section className="home-card finance-statement">
          <div className="home-card-title">
            <strong>Extrato</strong>
          </div>
          {transactions === null ? (
            <p className="finance-empty-text">Carregando extrato…</p>
          ) : transactions.length === 0 ? (
            <p className="finance-empty-text">Nenhum lançamento importado ainda.</p>
          ) : (
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{new Date(transaction.date).toLocaleDateString('pt-BR')}</td>
                      <td className={transaction.credit ? 'income' : 'expense'}>
                        {transaction.credit ? '+' : '-'} {formatCurrency(Math.abs(transaction.amount))}
                      </td>
                      <td>{transaction.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {dialog === 'newBank' && (
        <BankFormDialog
          onClose={closeDialog}
          onSave={async (name, debit, newCards) => {
            await createBank(uid, name, debit, newCards)
            await reload()
          }}
        />
      )}

      {bank && dialog === 'renameBank' && (
        <TextDialog
          title="Editar nome do banco"
          label="Nome do banco"
          initial={bank.name}
          onClose={closeDialog}
          onSave={async (name) => {
            await renameBank(uid, bank.id, name)
            await reload()
          }}
        />
      )}

      {bank && dialog === 'balance' && (
        <ValueDialog
          title="Editar saldo"
          label="Saldo"
          initial={bank.debit}
          onClose={closeDialog}
          onSave={async (value) => {
            await updateBankDebit(uid, bank.id, value)
            await reload()
          }}
        />
      )}

      {bank && dialog === 'deleteStatement' && (
        <ConfirmDialog
          title="Excluir extrato"
          message={`Tem certeza que deseja excluir todo o extrato importado de "${bank.name}"? Essa ação não pode ser desfeita. Os bancos, cartões e simulações de "${bank.name}" continuam intactos, só o extrato importado é apagado.`}
          confirmLabel="Excluir"
          onClose={closeDialog}
          onConfirm={async () => {
            await deleteStatement(uid, bank.id)
            setTransactions([])
          }}
        />
      )}

      {bank && dialog === 'deleteBank' && (
        <ConfirmDialog
          title="Excluir banco"
          message={`Tem certeza que deseja excluir "${bank.name}"? Essa ação não pode ser desfeita e apaga junto tudo relacionado a esse banco: lançamentos e Grupos em Simulações, e o extrato importado dele.`}
          confirmLabel="Excluir"
          onClose={closeDialog}
          onConfirm={async () => {
            await deleteBank(uid, bank.id)
            setBankIndex(0)
            setCardIndex(0)
            setTransactions(null)
            await reload()
          }}
        />
      )}

      {bank && dialog === 'newCard' && (
        <CardFormDialog
          cards={cards}
          onClose={closeDialog}
          onSave={async (updated) => {
            await saveCards(uid, bank.id, updated)
            await reload()
            setCardIndex(updated.length - 1)
          }}
        />
      )}

      {bank && card && dialog === 'editCard' && (
        <CardFormDialog
          card={card}
          cards={cards}
          onClose={closeDialog}
          onSave={async (updated) => {
            await saveCards(uid, bank.id, updated)
            await reload()
          }}
        />
      )}

      {bank && card && dialog === 'available' && (
        <ValueDialog
          title="Alterar Limite Disponível"
          label="Limite disponível"
          initial={available}
          onClose={closeDialog}
          onSave={async (value) => {
            if (value > card.limit) {
              throw new Error('O limite disponível não pode ser maior que o limite total do cartão.')
            }
            const updated = cards.map((existing) =>
              existing.id === card.id ? { ...existing, usedAmount: card.usedAmount + (available - value) } : existing,
            )
            await saveCards(uid, bank.id, updated)
            await reload()
          }}
        />
      )}

      {bank && card && dialog === 'deleteCard' && (
        <ConfirmDialog
          title="Excluir cartão"
          message="Tem certeza que deseja excluir este cartão? Essa ação não pode ser desfeita e apaga junto tudo relacionado a ele: os lançamentos e Grupos em Simulações que usam esse cartão."
          confirmLabel="Excluir"
          onClose={closeDialog}
          onConfirm={async () => {
            await deleteCard(
              uid,
              bank.id,
              card.id,
              cards.filter((existing) => existing.id !== card.id),
            )
            setCardIndex(0)
            await reload()
          }}
        />
      )}
    </div>
  )
}
