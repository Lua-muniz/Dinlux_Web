import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../components/Charts/Charts'
import OptionSelect, { type SelectOption } from '../../components/OptionSelect/OptionSelect'
import { loadBanks, type Bank, type Card } from '../../lib/dinluxData'
import { colorFor, resolveColors } from '../../lib/entityColors'
import { setCardLimit, updateBankCode, updateBankDebit } from '../../lib/finance'
import { saveInvoice } from '../../lib/invoice'
import { parseInvoice, type InvoiceTransaction } from '../../lib/invoiceParser'
import { parseStatementFile, readFileText, saveStatement, type ParsedTransaction } from '../../lib/statement'
import Modal from '../../components/Modal/Modal'
import './Importar.css'

type Tab = 'extrato' | 'fatura'

type Preview =
  | { tab: 'extrato'; fileName: string; transactions: ParsedTransaction[]; bankCode: string | null }
  | { tab: 'fatura'; fileName: string; transactions: InvoiceTransaction[]; total: number | null; status: string | null }

type CardSelection = { bank: Bank; card: Card }

const TABS: { id: Tab; label: string }[] = [
  { id: 'extrato', label: 'Extrato' },
  { id: 'fatura', label: 'Fatura' },
]

const EXPLANATIONS: Record<Tab, string> = {
  extrato:
    'Importe o extrato da sua conta (débito) exportado pelo app ou site do banco. Formatos aceitos: OFX (mais confiável) ou CSV (depende do layout de cada banco). Escolha abaixo o banco a que o extrato pertence.',
  fatura:
    'Importe a fatura do cartão de crédito exportada pelo app ou site do banco. Formatos aceitos: OFX ou CSV. O sistema reconhece as colunas de data, descrição e valor em reais, datas sem ano, parcelas e ignora as linhas de saldo anterior e de resumo. Escolha abaixo o cartão a que a fatura pertence.',
}

function formatDate(value: number): string {
  return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

function parseOptionalValue(text: string): number | null {
  const clean = text.replace(/R\$/gi, '').replace(/\s/g, '')
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const value = Number(normalized)
  return normalized !== '' && Number.isFinite(value) ? value : null
}

export default function Importar() {
  const { user } = useAuth()
  const uid = user?.uid
  const [banks, setBanks] = useState<Bank[]>([])
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [tab, setTab] = useState<Tab>('extrato')
  const [bankId, setBankId] = useState<string | null>(null)
  const [cardId, setCardId] = useState<string | null>(null)
  const [optionalText, setOptionalText] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [overLimit, setOverLimit] = useState<{ invoiceTotal: number; limit: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reloadBanks = useCallback(async () => {
    if (!uid) return
    try {
      setBanks(await loadBanks(uid))
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [uid])

  useEffect(() => {
    reloadBanks()
  }, [reloadBanks])

  const sortedBanks = useMemo(() => [...banks].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [banks])

  const colors = useMemo(
    () => resolveColors([...banks.map((bank) => bank.id), ...banks.flatMap((bank) => bank.cards.map((card) => card.id))]),
    [banks],
  )

  const bankOptions: SelectOption[] = sortedBanks.map((bank) => ({
    id: bank.id,
    title: bank.name,
    color: colorFor(colors, bank.id),
  }))

  const cardOptions: SelectOption[] = sortedBanks.flatMap((bank) =>
    bank.cards.map((card) => ({ id: card.id, title: card.label, subtitle: bank.name, color: colorFor(colors, card.id) })),
  )

  const selectedBank = banks.find((bank) => bank.id === bankId) ?? null
  const selectedCard: CardSelection | null = (() => {
    for (const bank of banks) {
      const card = bank.cards.find((item) => item.id === cardId)
      if (card) return { bank, card }
    }
    return null
  })()

  if (status === 'loading') return <p className="home-status">Carregando…</p>
  if (status === 'error') return <p className="home-status">Não foi possível carregar os dados.</p>
  if (!uid) return null

  function changeTab(next: Tab) {
    setTab(next)
    setOptionalText('')
    setFormError(null)
    setSaveError(null)
    setSuccess(null)
    setPreview(null)
  }

  function validate(): { error: string } | { value: number | null } {
    if (tab === 'extrato' && !selectedBank) return { error: 'Escolha o banco antes de selecionar o arquivo.' }
    if (tab === 'fatura' && !selectedCard) return { error: 'Escolha o cartão antes de selecionar o arquivo.' }

    const text = optionalText.trim()
    if (!text && tab === 'fatura') return { error: 'Informe o limite total do cartão para importar a fatura.' }
    if (!text) return { value: null }

    const value = parseOptionalValue(text)
    if (value === null) return { error: 'Informe um valor válido ou deixe o campo em branco.' }
    if (tab === 'fatura' && value <= 0) return { error: 'Informe um valor válido ou deixe o campo em branco.' }
    return { value }
  }

  async function handleFile(file: File) {
    setFormError(null)
    setSaveError(null)
    setSuccess(null)

    const validation = validate()
    if ('error' in validation) {
      setFormError(validation.error)
      return
    }

    try {
      const text = await readFileText(file)

      if (tab === 'extrato' && selectedBank) {
        const result = parseStatementFile(file.name, text)
        if (!result.ok) return setFormError(result.error)
        if (result.bankCode && selectedBank.bankCode && result.bankCode !== selectedBank.bankCode) {
          return setFormError('Este arquivo parece ser de um banco diferente do selecionado.')
        }
        setPreview({
          tab: 'extrato',
          fileName: file.name,
          transactions: result.transactions.slice().sort((a, b) => a.date - b.date),
          bankCode: result.bankCode && !selectedBank.bankCode ? result.bankCode : null,
        })
        return
      }

      const result = parseInvoice(text)
      if (!result.ok) return setFormError(result.error)
      if (result.transactions.length === 0) return setFormError('Nenhum lançamento encontrado nessa fatura.')
      setPreview({
        tab: 'fatura',
        fileName: file.name,
        transactions: result.transactions.slice().sort((a, b) => a.date - b.date),
        total: result.total,
        status: result.status,
      })
    } catch {
      setFormError('Não foi possível ler esse arquivo.')
    }
  }

  async function handleSave() {
    if (!uid || !preview) return
    const validation = validate()
    if ('error' in validation) {
      setSaveError(validation.error)
      return
    }

    if (preview.tab === 'fatura' && selectedCard && validation.value !== null) {
      const invoiceTotal = preview.transactions.filter((line) => !line.credit).reduce((sum, line) => sum + Math.abs(line.amount), 0)
      const limit = validation.value
      if (invoiceTotal > limit) {
        setOverLimit({ invoiceTotal, limit })
        return
      }
    }

    setSaving(true)
    setSaveError(null)
    try {
      let message: string
      if (preview.tab === 'extrato') {
        if (!selectedBank) return
        if (preview.bankCode) await updateBankCode(uid, selectedBank.id, preview.bankCode)
        await saveStatement(uid, selectedBank.id, preview.transactions)
        if (validation.value !== null) await updateBankDebit(uid, selectedBank.id, validation.value)
        message = validation.value !== null ? 'Extrato importado com sucesso. Saldo atualizado.' : 'Extrato importado com sucesso!'
      } else {
        if (!selectedCard) return
        await saveInvoice(uid, selectedCard.bank.id, selectedCard.card.id, preview.transactions)
        if (validation.value !== null) {
          await setCardLimit(uid, selectedCard.bank, selectedCard.card, validation.value)
        }
        message =
          validation.value !== null
            ? `Fatura de "${selectedCard.card.label}" importada com sucesso. Limite total atualizado.`
            : `Fatura de "${selectedCard.card.label}" importada com sucesso!`
      }
      setPreview(null)
      setOptionalText('')
      setSuccess(message)
      await reloadBanks()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar a importação.')
    } finally {
      setSaving(false)
    }
  }

  const isExtrato = tab === 'extrato'
  const selectedId = isExtrato ? bankId : cardId
  const accept = '.csv,.ofx,.qfx,.txt'

  return (
    <div className="importar">
      <div className="importar-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => changeTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="home-card importar-card">
        {preview ? (
          <>
            <div className="importar-summary">
              <strong>{preview.fileName}</strong>
              <span>
                {preview.tab === 'fatura' && selectedCard
                  ? `Cartão: ${selectedCard.card.label} (${selectedCard.bank.name})`
                  : selectedBank
                    ? `Banco: ${selectedBank.name}`
                    : ''}
              </span>
              <span>
                {preview.transactions.length} lançamento{preview.transactions.length === 1 ? '' : 's'} encontrado
                {preview.transactions.length === 1 ? '' : 's'}
              </span>
              {preview.transactions.length > 0 && (
                <span>
                  {formatDate(preview.transactions[0].date)} até {formatDate(preview.transactions[preview.transactions.length - 1].date)}
                </span>
              )}
              {preview.tab === 'fatura' && preview.total !== null && (
                <span>
                  Total da fatura: {formatCurrency(preview.total)}
                  {preview.status ? ` (${preview.status})` : ''}
                </span>
              )}
            </div>

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
                  {preview.transactions.map((transaction, index) => (
                    <tr key={index}>
                      <td>{formatDate(transaction.date)}</td>
                      <td className={transaction.credit ? 'income' : 'expense'}>
                        {transaction.credit ? '+' : '-'} {formatCurrency(Math.abs(transaction.amount))}
                      </td>
                      <td>{transaction.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {saveError && <p className="auth-form-error">{saveError}</p>}

            <div className="importar-actions">
              <button type="button" className="auth-form-submit" disabled={saving} onClick={handleSave}>
                {saving ? 'Salvando…' : 'Salvar Lançamentos'}
              </button>
              <button type="button" className="auth-form-link" onClick={() => setPreview(null)} disabled={saving}>
                Escolher outro arquivo
              </button>
            </div>
          </>
        ) : (
          <div className="auth-form importar-form">
            <p className="importar-explanation">{EXPLANATIONS[tab]}</p>

            <div className="importar-field">
              <span className="importar-label">{isExtrato ? 'Banco' : 'Cartão de crédito'}</span>
              <OptionSelect
                label={isExtrato ? 'Banco' : 'Cartão de crédito'}
                placeholder={isExtrato ? 'Selecione o banco' : 'Selecione o cartão'}
                emptyText={
                  isExtrato
                    ? 'Nenhum banco cadastrado. Crie um banco em Finanças primeiro.'
                    : 'Nenhum cartão cadastrado. Crie um cartão em Finanças primeiro.'
                }
                options={isExtrato ? bankOptions : cardOptions}
                value={selectedId}
                onChange={(id) => {
                  setFormError(null)
                  if (isExtrato) setBankId(id)
                  else setCardId(id)
                }}
              />
            </div>

            <label className="importar-field">
              <span className="importar-label">{isExtrato ? 'Saldo atual (opcional)' : 'Limite total do cartão (obrigatório)'}</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="Ex: 180,00"
                value={optionalText}
                onChange={(event) => {
                  setFormError(null)
                  setOptionalText(event.target.value)
                }}
              />
              <small className="importar-help">
                {isExtrato
                  ? 'Se informado, o saldo do banco é atualizado ao salvar a importação.'
                  : 'Obrigatório: o limite total cadastrado do cartão é atualizado ao salvar a importação.'}
              </small>
            </label>

            <div
              className={`importar-dropzone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragOver(false)
                const file = event.dataTransfer.files[0]
                if (file) handleFile(file)
              }}
            >
              <p>Arraste o arquivo {isExtrato ? 'do extrato' : 'da fatura'} aqui</p>
              <span className="importar-dropzone-hint">Formatos aceitos: .csv, .ofx</span>
              <button type="button" className="auth-form-submit" onClick={() => fileInputRef.current?.click()}>
                Selecionar arquivo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={accept}
                className="importar-file-input"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) handleFile(file)
                  event.target.value = ''
                }}
              />
            </div>

            {formError && <p className="auth-form-error">{formError}</p>}
            {success && <p className="importar-success">{success}</p>}
          </div>
        )}
      </section>

      {overLimit && selectedCard && (
        <Modal
          title="Fatura acima do limite do cartão"
          onClose={() => {
            setOverLimit(null)
            setPreview(null)
          }}
        >
          <div className="auth-form">
            <p className="settings-current">
              {`As compras dessa fatura somam ${formatCurrency(overLimit.invoiceTotal)}, mais que o limite total informado de "${selectedCard.card.label}" (${formatCurrency(overLimit.limit)}). Confira o limite total atual do cartão, corrija o campo e importe a fatura novamente.`}
            </p>
            <button
              type="button"
              className="auth-form-submit"
              onClick={() => {
                setOverLimit(null)
                setPreview(null)
              }}
            >
              Entendi
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
