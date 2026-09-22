import { useState, type FormEvent } from 'react'
import Modal from '../../components/Modal/Modal'
import { formatCurrency } from '../../components/Charts/Charts'

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

/** "Sair do chat": pergunta se mantém as confirmações feitas na sessão ou descarta tudo. */
export function ExitChoiceDialog({
  actionCount,
  onKeep,
  onDiscard,
  onCancel,
}: {
  actionCount: number
  onKeep: () => void
  onDiscard: () => void
  onCancel: () => void
}) {
  return (
    <Modal title="Sair do chat" onClose={onCancel}>
      <div className="auth-form">
        <p className="settings-current">
          Você confirmou ou desmarcou {actionCount} período(s) nessa sessão. Deseja manter essas alterações ou descartar
          tudo, voltando ao estado de antes de abrir esse chat?
        </p>
        <button type="button" className="auth-form-submit avisos-keep-button" onClick={onKeep}>
          Manter e sair
        </button>
        <button type="button" className="avisos-discard-link" onClick={onDiscard}>
          Descartar tudo
        </button>
        <button type="button" className="auth-form-link" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </Modal>
  )
}

/** Confirmação final antes de desfazer todas as ações da sessão. */
export function DiscardConfirmDialog({ onConfirm, onCancel }: { onConfirm: () => Promise<void>; onCancel: () => void }) {
  const { error, busy, run } = useAction()
  return (
    <Modal title="Descartar confirmações?" onClose={onCancel}>
      <div className="auth-form">
        <p className="settings-current">
          As confirmações feitas agora nesse chat não vão ser salvas — as pendências voltam a aparecer como antes de
          você entrar. Descartar mesmo assim?
        </p>
        {error && <p className="auth-form-error">{error}</p>}
        <button
          type="button"
          className="auth-form-submit settings-danger"
          disabled={busy}
          onClick={() => run(async () => onConfirm())}
        >
          {busy ? 'Descartando…' : 'Descartar'}
        </button>
        <button type="button" className="auth-form-link" onClick={onCancel}>
          Voltar
        </button>
      </div>
    </Modal>
  )
}

function InsufficientDialog({
  title,
  message,
  onUpdate,
  onGiveUp,
}: {
  title: string
  message: string
  onUpdate: (value: number) => Promise<void>
  onGiveUp: () => void
}) {
  const [text, setText] = useState('')
  const { error, busy, run, setError } = useAction()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const value = parseDecimal(text)
    if (value === null) return setError('Informe um valor válido.')
    run(() => onUpdate(value))
  }

  return (
    <Modal title={title} onClose={onGiveUp} dismissible={false}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="settings-current">{message}</p>
        <label>
          Valor real
          <input
            type="text"
            inputMode="decimal"
            placeholder="Ex: 180,00"
            value={text}
            onChange={(event) => setText(event.target.value)}
            autoFocus
          />
        </label>
        {error && <p className="auth-form-error">{error}</p>}
        <button type="submit" className="auth-form-submit" disabled={busy}>
          {busy ? 'Atualizando…' : 'Atualizar'}
        </button>
        <button type="button" className="auth-form-link" disabled={busy} onClick={onGiveUp}>
          Fechar
        </button>
      </form>
    </Modal>
  )
}

export function InsufficientBalanceDialog({
  bankName,
  saldo,
  onUpdate,
  onGiveUp,
}: {
  bankName: string
  saldo: number
  onUpdate: (value: number) => Promise<void>
  onGiveUp: () => void
}) {
  return (
    <InsufficientDialog
      title="Saldo insuficiente"
      message={`O saldo atual de "${bankName}" (${formatCurrency(saldo)}) ficou negativo com essas confirmações. Qual é o seu saldo atual de verdade?`}
      onUpdate={onUpdate}
      onGiveUp={onGiveUp}
    />
  )
}

export function InsufficientLimitDialog({
  cardLabel,
  limite,
  onUpdate,
  onGiveUp,
}: {
  cardLabel: string
  limite: number
  onUpdate: (value: number) => Promise<void>
  onGiveUp: () => void
}) {
  return (
    <InsufficientDialog
      title="Limite insuficiente"
      message={`O limite disponível do cartão "${cardLabel}" (${formatCurrency(limite)}) ficou negativo com essas confirmações. Qual é o limite disponível real desse cartão agora?`}
      onUpdate={onUpdate}
      onGiveUp={onGiveUp}
    />
  )
}

export function CardClosingInfoDialog({
  titulo,
  cardLabel,
  closingDayAtCreation,
  closingDayNow,
  onClose,
}: {
  titulo: string
  cardLabel: string
  closingDayAtCreation: number
  closingDayNow: number
  onClose: () => void
}) {
  return (
    <Modal title="Fechamento do cartão foi alterado" onClose={onClose}>
      <div className="auth-form">
        <p className="settings-current">
          A compra "{titulo}" foi feita quando o cartão "{cardLabel}" fechava dia {closingDayAtCreation}. Hoje esse
          cartão fecha dia {closingDayNow}.
          <br />
          <br />
          Os ciclos e parcelas mostrados aqui continuam calculados com o dia {closingDayAtCreation} (o que valia no
          momento da compra), pra não bagunçar parcelas que já estavam em andamento. Isso é só um aviso — nada foi
          alterado automaticamente nessa compra.
        </p>
        <button type="button" className="auth-form-submit" onClick={onClose}>
          Entendi
        </button>
      </div>
    </Modal>
  )
}
