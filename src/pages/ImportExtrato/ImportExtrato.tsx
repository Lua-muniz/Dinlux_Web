import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../components/Charts/Charts'
import { loadBanks, type Bank } from '../../lib/dinluxData'
import { updateBankDebit, updateBankCode } from '../../lib/finance'
import { parseStatementFile, readFileText, saveStatement, type ParsedTransaction } from '../../lib/statement'
import { ValueDialog } from '../Finance/FinanceDialogs'
import './ImportExtrato.css'

function formatDate(value: number): string {
  return new Date(value).toLocaleDateString('pt-BR')
}

export default function ImportExtrato() {
  const { user } = useAuth()
  const uid = user?.uid
  const [banks, setBanks] = useState<Bank[]>([])
  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false)
  const [parsed, setParsed] = useState<ParsedTransaction[] | null>(null)
  const [pendingBankCode, setPendingBankCode] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const parseSucceededRef = useRef(false)

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

  useEffect(() => {
    if (banks.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !banks.some((bank) => bank.id === selectedId)) {
      setSelectedId(banks[0].id)
    }
  }, [banks, selectedId])

  function resetImport() {
    setPendingFile(null)
    setParsed(null)
    setPendingBankCode(null)
    setSaveError(null)
    setSuccess(false)
  }

  useEffect(() => {
    resetImport()
  }, [selectedId])

  if (status === 'loading') return <p className="home-status">Carregando…</p>
  if (status === 'error') return <p className="home-status">Não foi possível carregar os dados.</p>
  if (!uid) return null

  const selectedBank = banks.find((bank) => bank.id === selectedId) ?? null

  function handleFile(file: File) {
    resetImport()
    setPendingFile(file)
    setBalanceDialogOpen(true)
  }

  async function handleSave() {
    if (!uid || !selectedBank || !parsed) return
    setSaving(true)
    setSaveError(null)
    try {
      if (pendingBankCode) await updateBankCode(uid, selectedBank.id, pendingBankCode)
      await saveStatement(uid, selectedBank.id, parsed)
      resetImport()
      setSuccess(true)
      await reloadBanks()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar o extrato.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="extrato">
      <section className="home-card listas-sidebar">
        <div className="listas-sidebar-header">
          <strong>Bancos</strong>
        </div>

        {banks.length === 0 ? (
          <p className="finance-empty-text">Nenhum banco cadastrado. Crie um banco em Finanças primeiro.</p>
        ) : (
          <div className="listas-list-rows">
            {banks.map((bank) => (
              <div
                key={bank.id}
                className={`listas-list-row ${bank.id === selectedId ? 'active' : ''}`}
                onClick={() => setSelectedId(bank.id)}
              >
                <span className="listas-list-title">{bank.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="home-card listas-main">
        {!selectedBank ? (
          <div className="finance-empty">
            <p>Selecione um banco para importar o extrato.</p>
          </div>
        ) : parsed ? (
          <>
            <div className="extrato-summary">
              <strong>{pendingFile?.name}</strong>
              <span>
                {parsed.length} lançamento{parsed.length === 1 ? '' : 's'} encontrado{parsed.length === 1 ? '' : 's'}
              </span>
              {parsed.length > 0 && (
                <span>
                  {formatDate(parsed[0].date)} até {formatDate(parsed[parsed.length - 1].date)}
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
                  {parsed.map((transaction, index) => (
                    <tr key={index}>
                      <td>{formatDate(transaction.date)}</td>
                      <td className={transaction.credit ? 'income' : 'expense'}>
                        {transaction.credit ? '+' : '-'} {formatCurrency(transaction.amount)}
                      </td>
                      <td>{transaction.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {saveError && <p className="auth-form-error">{saveError}</p>}

            <div className="extrato-actions">
              <button type="button" className="auth-form-submit" disabled={saving} onClick={handleSave}>
                {saving ? 'Salvando…' : 'Salvar Lançamento'}
              </button>
              <button type="button" className="auth-form-link" onClick={resetImport} disabled={saving}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <>
            <div
              className={`extrato-dropzone ${dragOver ? 'drag-over' : ''}`}
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
              <p>Arraste o arquivo do extrato aqui</p>
              <span className="extrato-dropzone-hint">Formatos aceitos: .csv, .ofx</span>
              <button type="button" className="auth-form-submit" onClick={() => fileInputRef.current?.click()}>
                Selecionar arquivo
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.ofx"
                className="extrato-file-input"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) handleFile(file)
                  event.target.value = ''
                }}
              />
            </div>
            {success && <p className="extrato-success">Extrato importado com sucesso!</p>}
          </>
        )}
      </section>

      {balanceDialogOpen && selectedBank && pendingFile && (
        <ValueDialog
          title="Saldo atual"
          label="Qual o seu saldo atual?"
          initial={selectedBank.debit}
          onClose={() => {
            setBalanceDialogOpen(false)
            if (!parseSucceededRef.current) resetImport()
            parseSucceededRef.current = false
          }}
          onSave={async (value) => {
            await updateBankDebit(uid, selectedBank.id, value)
            await reloadBanks()

            const text = await readFileText(pendingFile)
            const result = parseStatementFile(pendingFile.name, text)
            if (!result.ok) throw new Error(result.error)
            if (result.bankCode && selectedBank.bankCode && result.bankCode !== selectedBank.bankCode) {
              throw new Error('Este arquivo parece ser de um banco diferente do selecionado.')
            }

            setPendingBankCode(result.bankCode && !selectedBank.bankCode ? result.bankCode : null)
            setParsed(result.transactions.slice().sort((a, b) => a.date - b.date))
            parseSucceededRef.current = true
          }}
        />
      )}
    </div>
  )
}
