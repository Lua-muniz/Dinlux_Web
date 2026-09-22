import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { formatCurrency } from '../../components/Charts/Charts'
import { loadBanks, type Bank, type SimulationEntry } from '../../lib/dinluxData'
import {
  contactsFromSections,
  loadActiveCreditPurchases,
  loadAvisoSections,
  markBankSeen,
  toggleSavingsPeriod,
  togglePurchaseCycle,
  type AvisoContact,
  type AvisoSection,
} from '../../lib/avisos'
import { availableCardLimit, type Period } from '../../lib/simulationCalc'
import { updateBankDebit, saveCards } from '../../lib/finance'
import { deleteEntry } from '../../lib/simulations'
import { ConfirmDialog } from '../Finance/FinanceDialogs'
import DropdownMenu from '../../components/DropdownMenu/DropdownMenu'
import {
  CardClosingInfoDialog,
  DiscardConfirmDialog,
  ExitChoiceDialog,
  InsufficientBalanceDialog,
  InsufficientLimitDialog,
} from './AvisosDialogs'
import './Avisos.css'

const DOTS = 'M5 12h.01M12 12h.01M19 12h.01'
const CHEVRON = 'M6 9l6 6 6-6'
const WARNING = 'M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z'
const CLOSE = 'M6 6l12 12M18 6 6 18'

const monthOnlyFormat = new Intl.DateTimeFormat('pt-BR', { month: 'long' })

function formatMonth(key: number): string {
  const date = new Date(key)
  const month = monthOnlyFormat.format(date)
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}/${date.getFullYear()}`
}

function monthIndexOf(key: number): number {
  const date = new Date(key)
  return date.getFullYear() * 12 + date.getMonth()
}

function currentMonthIndex(): number {
  return monthIndexOf(Date.now())
}

function valorDaSecao(section: AvisoSection): number {
  return section.tipo === 'SAVINGS' ? section.entry.monthlyAmount : section.entry.installmentValue
}

type CardLimit = { cardId: string; cardLabel: string; limiteProjetado: number }
type Acao = { section: AvisoSection; mensagem: Period; confirmarAplicado: boolean }
type PendingAction = { kind: 'bank'; bankId: string } | { kind: 'close' } | { kind: 'nav'; path: string }

type DialogState =
  | { kind: 'exitChoice' }
  | { kind: 'discardConfirm' }
  | { kind: 'insufficientBalance' }
  | { kind: 'insufficientLimit'; card: CardLimit }
  | { kind: 'deleteEntry'; section: AvisoSection }
  | { kind: 'undoConfirm'; section: AvisoSection; mensagem: Period }
  | { kind: 'cardInfo'; section: AvisoSection }

function Icon({ d, rotated }: { d: string; rotated?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: rotated ? 'rotate(-90deg)' : undefined, transition: 'transform 0.15s' }}
    >
      <path d={d} />
    </svg>
  )
}

function computeLimits(
  bankId: string,
  bankSections: AvisoSection[],
  banks: Bank[],
  creditPurchases: SimulationEntry[],
): CardLimit[] {
  const bank = banks.find((b) => b.id === bankId)
  const cardIds = new Set(
    bankSections.filter((s) => s.tipo === 'PURCHASE' && s.entry.paymentMethod === 'CREDIT').map((s) => s.entry.cardId),
  )
  if (!bank || cardIds.size === 0) return []
  return bank.cards
    .filter((card) => cardIds.has(card.id))
    .map((card) => ({
      cardId: card.id,
      cardLabel: card.label,
      limiteProjetado: availableCardLimit(
        card.limit,
        creditPurchases.filter((entry) => entry.cardId === card.id),
        card.usedAmount,
      ),
    }))
    .sort((a, b) => a.cardLabel.localeCompare(b.cardLabel))
}

type LoadedData = { banks: Bank[]; sections: AvisoSection[]; creditPurchases: SimulationEntry[] }

export default function Avisos() {
  const { user } = useAuth()
  const uid = user?.uid
  const navigate = useNavigate()

  const [status, setStatus] = useState<'loading' | 'error' | 'ready'>('loading')
  const [banks, setBanks] = useState<Bank[]>([])
  const [sections, setSections] = useState<AvisoSection[]>([])
  const [creditPurchases, setCreditPurchases] = useState<SimulationEntry[]>([])

  const [selectedBankId, setSelectedBankId] = useState<string | null>(null)
  const [saldoProjetado, setSaldoProjetado] = useState(0)
  const [saldoCarregado, setSaldoCarregado] = useState(false)
  const [limites, setLimites] = useState<CardLimit[]>([])
  const [limitesExpandido, setLimitesExpandido] = useState(true)
  const [historico, setHistorico] = useState<Acao[]>([])
  const [locked, setLocked] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())

  const reload = useCallback(async (): Promise<LoadedData | null> => {
    if (!uid) return null
    try {
      const [loadedBanks, loadedSections, loadedCredit] = await Promise.all([
        loadBanks(uid),
        loadAvisoSections(uid),
        loadActiveCreditPurchases(uid),
      ])
      setBanks(loadedBanks)
      setSections(loadedSections)
      setCreditPurchases(loadedCredit)
      setStatus('ready')
      return { banks: loadedBanks, sections: loadedSections, creditPurchases: loadedCredit }
    } catch {
      setStatus('error')
      return null
    }
  }, [uid])

  useEffect(() => {
    reload()
  }, [reload])

  const contacts: AvisoContact[] = useMemo(() => contactsFromSections(sections), [sections])
  const chatSections = useMemo(
    () => sections.filter((section) => section.bankId === selectedBankId),
    [sections, selectedBankId],
  )
  const selectedBank = banks.find((bank) => bank.id === selectedBankId) ?? null
  const selectedContact = contacts.find((contact) => contact.bankId === selectedBankId) ?? null

  useEffect(() => {
    if (!selectedBankId) return
    const newIds = chatSections.map((section) => section.entry.id).filter((id) => !knownIdsRef.current.has(id))
    if (newIds.length === 0) return
    newIds.forEach((id) => knownIdsRef.current.add(id))
    setCollapsed((current) => {
      const next = new Set(current)
      newIds.forEach((id) => next.add(id))
      return next
    })
  }, [chatSections, selectedBankId])

  function openBank(bankId: string, data?: LoadedData) {
    const useBanks = data?.banks ?? banks
    const useSections = data?.sections ?? sections
    const useCredit = data?.creditPurchases ?? creditPurchases

    setSelectedBankId(bankId)
    setHistorico([])
    setLocked(new Set())
    setCollapsed(new Set())
    knownIdsRef.current = new Set()
    setLimitesExpandido(true)
    setPageError(null)

    const bank = useBanks.find((b) => b.id === bankId)
    setSaldoProjetado(bank?.debit ?? 0)
    setSaldoCarregado(!!bank)

    const bankSections = useSections.filter((section) => section.bankId === bankId)
    if (uid) markBankSeen(uid, bankSections).catch(() => {})
    setLimites(computeLimits(bankId, bankSections, useBanks, useCredit))
  }

  function closeChat() {
    setSelectedBankId(null)
    setHistorico([])
    setLocked(new Set())
    setCollapsed(new Set())
    setLimites([])
    setSaldoCarregado(false)
    setDialog(null)
    setPendingAction(null)
  }

  function performPendingAction(data?: LoadedData) {
    const action = pendingAction
    setPendingAction(null)
    setDialog(null)
    if (!action || action.kind === 'close') {
      closeChat()
    } else if (action.kind === 'bank') {
      openBank(action.bankId, data)
    } else {
      closeChat()
      navigate(action.path)
    }
  }

  function verificarPendencias() {
    if (saldoProjetado < 0) {
      setDialog({ kind: 'insufficientBalance' })
      return
    }
    const negativo = limites.find((limite) => limite.limiteProjetado < 0)
    if (negativo) {
      setDialog({ kind: 'insufficientLimit', card: negativo })
      return
    }
    setDialog({ kind: 'exitChoice' })
  }

  function requestOpenBank(bankId: string) {
    if (bankId === selectedBankId) return
    if (!saldoCarregado || historico.length === 0) {
      openBank(bankId)
      return
    }
    setPendingAction({ kind: 'bank', bankId })
    verificarPendencias()
  }

  function requestCloseChat() {
    if (!saldoCarregado || historico.length === 0) {
      closeChat()
      return
    }
    setPendingAction({ kind: 'close' })
    verificarPendencias()
  }

  useEffect(() => {
    if (historico.length === 0) return

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as HTMLElement | null)?.closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#')) return
      let url: URL
      try {
        url = new URL(href, window.location.origin)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (url.pathname === '/painel/avisos') return
      event.preventDefault()
      event.stopPropagation()
      setPendingAction({ kind: 'nav', path: `${url.pathname}${url.search}` })
      verificarPendencias()
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    document.addEventListener('click', handleClick, true)
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historico.length])

  function toggleCollapse(entryId: string) {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  function registrarAcao(section: AvisoSection, confirmarAplicado: boolean) {
    const valor = valorDaSecao(section)
    const saldoSign = confirmarAplicado ? -1 : 1
    setSaldoProjetado((atual) => atual + valor * saldoSign)
    if (section.tipo === 'PURCHASE' && section.entry.paymentMethod === 'CREDIT') {
      const limitSign = confirmarAplicado ? 1 : -1
      setLimites((current) =>
        current.map((limite) =>
          limite.cardId === section.entry.cardId
            ? { ...limite, limiteProjetado: limite.limiteProjetado + valor * limitSign }
            : limite,
        ),
      )
    }
  }

  async function refreshAfterAction(bankId: string) {
    const fresh = await reload()
    if (!fresh) return
    setLimites(computeLimits(bankId, fresh.sections.filter((s) => s.bankId === bankId), fresh.banks, fresh.creditPurchases))
  }

  async function handleConfirmar(section: AvisoSection, mensagem: Period) {
    if (!uid) return
    const key = `${section.entry.id}:${mensagem.key}`
    setLocked((current) => new Set(current).add(key))
    setPageError(null)
    try {
      if (section.tipo === 'SAVINGS') await toggleSavingsPeriod(uid, section.entry, mensagem.key, true)
      else await togglePurchaseCycle(uid, section.entry, mensagem.key, true)
      registrarAcao(section, true)
      setHistorico((current) => [...current, { section, mensagem, confirmarAplicado: true }])
      await refreshAfterAction(section.bankId)
    } catch (err) {
      setPageError(err instanceof Error ? err.message : 'Erro ao confirmar')
    } finally {
      setLocked((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  async function confirmDesmarcar(section: AvisoSection, mensagem: Period) {
    if (!uid) return
    const key = `${section.entry.id}:${mensagem.key}`
    setLocked((current) => new Set(current).add(key))
    try {
      if (section.tipo === 'SAVINGS') await toggleSavingsPeriod(uid, section.entry, mensagem.key, false)
      else await togglePurchaseCycle(uid, section.entry, mensagem.key, false)
      registrarAcao(section, false)
      setHistorico((current) => [...current, { section, mensagem, confirmarAplicado: false }])
      setDialog(null)
      await refreshAfterAction(section.bankId)
    } finally {
      setLocked((current) => {
        const next = new Set(current)
        next.delete(key)
        return next
      })
    }
  }

  async function handleDeleteEntry(section: AvisoSection) {
    if (!uid) return
    await deleteEntry(uid, section.entry)
    setDialog(null)
    await refreshAfterAction(section.bankId)
  }

  async function confirmDiscard() {
    if (!uid) return
    const acoes = [...historico].reverse()
    for (const acao of acoes) {
      const confirmarParaDesfazer = !acao.confirmarAplicado
      try {
        if (acao.section.tipo === 'SAVINGS') {
          await toggleSavingsPeriod(uid, acao.section.entry, acao.mensagem.key, confirmarParaDesfazer)
        } else {
          await togglePurchaseCycle(uid, acao.section.entry, acao.mensagem.key, confirmarParaDesfazer)
        }
      } catch {
        // segue descartando as outras mesmo se uma falhar, igual ao app
      }
    }
    setHistorico([])
    const fresh = await reload()
    performPendingAction(fresh ?? undefined)
  }

  async function handleUpdateBalance(value: number) {
    if (!uid || !selectedBankId) return
    await updateBankDebit(uid, selectedBankId, value)
    setSaldoProjetado(value)
    if (value < 0) {
      setDialog({ kind: 'insufficientBalance' })
      return
    }
    const negativo = limites.find((limite) => limite.limiteProjetado < 0)
    setDialog(negativo ? { kind: 'insufficientLimit', card: negativo } : { kind: 'exitChoice' })
  }

  async function handleUpdateLimit(card: CardLimit, novoLimiteReal: number) {
    if (!uid || !selectedBank) return
    const diferenca = card.limiteProjetado - novoLimiteReal
    const cardAtual = selectedBank.cards.find((c) => c.id === card.cardId)
    const usedAmountAtual = cardAtual?.usedAmount ?? 0
    const updatedCards = selectedBank.cards.map((c) =>
      c.id === card.cardId ? { ...c, usedAmount: usedAmountAtual + diferenca } : c,
    )
    await saveCards(uid, selectedBank.id, updatedCards)
    const novosLimites = limites.map((limite) => (limite.cardId === card.cardId ? { ...limite, limiteProjetado: novoLimiteReal } : limite))
    setLimites(novosLimites)
    const negativo = novosLimites.find((limite) => limite.limiteProjetado < 0)
    setDialog(negativo ? { kind: 'insufficientLimit', card: negativo } : { kind: 'exitChoice' })
  }

  if (status === 'loading') return <p className="home-status">Carregando…</p>
  if (status === 'error') return <p className="home-status">Não foi possível carregar os avisos.</p>
  if (!uid) return null

  return (
    <div className="avisos">
      <section className="home-card avisos-sidebar">
        <strong className="avisos-sidebar-title">Avisos</strong>
        {contacts.length === 0 ? (
          <p className="finance-empty-text">Nenhum aviso por enquanto.</p>
        ) : (
          <div className="avisos-contact-rows">
            {contacts.map((contact) => (
              <button
                key={contact.bankId}
                type="button"
                className={`avisos-contact-row ${contact.bankId === selectedBankId ? 'active' : ''}`}
                onClick={() => requestOpenBank(contact.bankId)}
              >
                <span className="avisos-contact-name">{contact.bankName}</span>
                {contact.naoVistasCount > 0 && <span className="avisos-contact-badge">{contact.naoVistasCount}</span>}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="home-card avisos-main">
        {!selectedBankId ? (
          <div className="finance-empty">
            <p>Selecione um banco pra ver os avisos.</p>
          </div>
        ) : (
          <>
            <div className="avisos-chat-header">
              <h2 className="avisos-chat-title">{selectedContact?.bankName ?? selectedBank?.name ?? ''}</h2>
              <button type="button" className="finance-icon-button" aria-label="Fechar conversa" onClick={requestCloseChat}>
                <Icon d={CLOSE} />
              </button>
            </div>

            {saldoCarregado && (
              <p className={`avisos-saldo ${saldoProjetado < 0 ? 'negative' : ''}`}>Saldo: {formatCurrency(saldoProjetado)}</p>
            )}

            {limites.length > 0 && (
              <div className="avisos-limites">
                <button type="button" className="avisos-limites-header" onClick={() => setLimitesExpandido((v) => !v)}>
                  <span>Limites dos Cartões</span>
                  <Icon d={CHEVRON} rotated={!limitesExpandido} />
                </button>
                {limitesExpandido && (
                  <div className="avisos-limites-body">
                    {limites.map((limite) => (
                      <p key={limite.cardId} className={limite.limiteProjetado < 0 ? 'negative' : ''}>
                        Limite {limite.cardLabel}: {formatCurrency(limite.limiteProjetado)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {pageError && <p className="auth-form-error">{pageError}</p>}

            {chatSections.length === 0 ? (
              <p className="finance-empty-text">Nenhum aviso desse banco por enquanto.</p>
            ) : (
              <div className="avisos-chat-list">
                {chatSections.map((section) => {
                  const isCollapsed = collapsed.has(section.entry.id)
                  return (
                    <div key={section.entry.id} className="avisos-section">
                      <div className="avisos-section-header">
                        {section.naoVistasCount > 0 && <span className="avisos-section-dot" />}
                        <button type="button" className="avisos-section-titles" onClick={() => toggleCollapse(section.entry.id)}>
                          <span className="avisos-section-title">{section.titulo}</span>
                          <span className="avisos-section-subtitle">{section.subtitulo}</span>
                        </button>
                        {section.cardFechamentoAlterado && (
                          <button
                            type="button"
                            className="finance-icon-button avisos-warning-button"
                            aria-label="Fechamento do cartão alterado"
                            onClick={() => setDialog({ kind: 'cardInfo', section })}
                          >
                            <Icon d={WARNING} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="finance-icon-button"
                          aria-label={isCollapsed ? 'Expandir sessão' : 'Recolher sessão'}
                          onClick={() => toggleCollapse(section.entry.id)}
                        >
                          <Icon d={CHEVRON} rotated={isCollapsed} />
                        </button>
                        {section.finalizada && (
                          <DropdownMenu
                            label={`Opções de ${section.titulo}`}
                            icon={DOTS}
                            align="right"
                            items={[{ label: 'Excluir', danger: true, onSelect: () => setDialog({ kind: 'deleteEntry', section }) }]}
                          />
                        )}
                      </div>

                      {!isCollapsed && (
                        <div className="avisos-messages">
                          {section.mensagens.map((mensagem) => {
                            const key = `${section.entry.id}:${mensagem.key}`
                            const atrasada = !mensagem.paid && monthIndexOf(mensagem.key) < currentMonthIndex()
                            const detalhe = mensagem.paid ? 'Confirmada' : atrasada ? 'Atrasada' : 'Pendente'
                            const detalheClass = mensagem.paid ? 'positive' : atrasada ? 'negative' : ''
                            return (
                              <label key={key} className="avisos-message-card">
                                <div className="avisos-message-info">
                                  <span className="avisos-message-date">{formatMonth(mensagem.key)}</span>
                                  <span className="avisos-message-question">
                                    {section.tipo === 'SAVINGS'
                                      ? `A economia "${section.titulo}" no valor de ${formatCurrency(section.entry.monthlyAmount)} foi guardada?`
                                      : `A parcela de "${section.titulo}" (${section.subtitulo}) no valor de ${formatCurrency(section.entry.installmentValue)} foi paga?`}
                                  </span>
                                  <span className={`avisos-message-detail ${detalheClass}`}>{detalhe}</span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={mensagem.paid}
                                  disabled={locked.has(key)}
                                  onChange={(event) => {
                                    const checked = event.target.checked
                                    if (checked && !mensagem.paid) handleConfirmar(section, mensagem)
                                    else if (!checked && mensagem.paid) setDialog({ kind: 'undoConfirm', section, mensagem })
                                  }}
                                />
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </section>

      {dialog?.kind === 'exitChoice' && (
        <ExitChoiceDialog
          actionCount={historico.length}
          onKeep={() => performPendingAction()}
          onDiscard={() => setDialog({ kind: 'discardConfirm' })}
          onCancel={() => {
            setDialog(null)
            setPendingAction(null)
          }}
        />
      )}

      {dialog?.kind === 'discardConfirm' && <DiscardConfirmDialog onConfirm={confirmDiscard} onCancel={() => setDialog(null)} />}

      {dialog?.kind === 'insufficientBalance' && selectedBank && (
        <InsufficientBalanceDialog
          bankName={selectedBank.name}
          saldo={saldoProjetado}
          onUpdate={handleUpdateBalance}
          onGiveUp={() => setDialog({ kind: 'discardConfirm' })}
        />
      )}

      {dialog?.kind === 'insufficientLimit' && (
        <InsufficientLimitDialog
          cardLabel={dialog.card.cardLabel}
          limite={dialog.card.limiteProjetado}
          onUpdate={(value) => handleUpdateLimit(dialog.card, value)}
          onGiveUp={() => setDialog({ kind: 'discardConfirm' })}
        />
      )}

      {dialog?.kind === 'deleteEntry' && (
        <ConfirmDialog
          title="Excluir lançamento"
          message={`Isso exclui "${dialog.section.titulo}" por completo — some do módulo de Avisos E da simulação (não aparece mais no canvas). Essa ação não pode ser desfeita. Excluir mesmo assim?`}
          confirmLabel="Excluir"
          onClose={() => setDialog(null)}
          onConfirm={() => handleDeleteEntry(dialog.section)}
        />
      )}

      {dialog?.kind === 'undoConfirm' && (
        <ConfirmDialog
          title="Desfazer confirmação"
          message={`Desfazer a confirmação de ${formatMonth(dialog.mensagem.key)} de "${dialog.section.titulo}"? Isso devolve ${formatCurrency(valorDaSecao(dialog.section))} pro saldo de ${dialog.section.bankName}.`}
          confirmLabel="Desfazer"
          onClose={() => setDialog(null)}
          onConfirm={() => confirmDesmarcar(dialog.section, dialog.mensagem)}
        />
      )}

      {dialog?.kind === 'cardInfo' && (
        <CardClosingInfoDialog
          titulo={dialog.section.titulo}
          cardLabel={dialog.section.entry.cardLabel}
          closingDayAtCreation={dialog.section.entry.cardClosingDay}
          closingDayNow={dialog.section.cardFechamentoAtual}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  )
}
