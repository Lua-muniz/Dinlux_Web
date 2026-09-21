import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { mapAuthError } from '../../lib/authErrors'
import {
  changePassword,
  deleteAccount,
  loadTermsAcceptance,
  requestEmailChange,
  updateName,
} from '../../lib/account'
import { buildJson, buildPdf, downloadFile, exportFilename, loadAllUserData } from '../../lib/exportData'
import { TERMS_BLOCKS } from '../../lib/terms'
import '../AuthModal/AuthModal.css'
import './SettingsDialogs.css'

export type SettingsDialogKind = 'name' | 'email' | 'password' | 'privacy' | 'export' | 'delete'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function errorMessage(error: unknown): string {
  return error instanceof Error && !('code' in error) ? error.message : mapAuthError(error)
}

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal settings-dialog" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
        <h2 className="auth-modal-title">{title}</h2>
        {children}
      </div>
    </div>
  )
}

function useSubmit(onDone?: () => void) {
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function run(action: () => Promise<string | void>) {
    setError(null)
    setInfo(null)
    setSubmitting(true)
    try {
      const message = await action()
      if (message) setInfo(message)
      else onDone?.()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return { error, info, submitting, run, setError }
}

function Feedback({ error, info }: { error: string | null; info: string | null }) {
  return (
    <>
      {error && <p className="auth-form-error">{error}</p>}
      {info && <p className="auth-form-info">{info}</p>}
    </>
  )
}

function NameDialog({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth()
  const [name, setName] = useState('')
  const { error, info, submitting, run, setError } = useSubmit()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setError('Digite um nome válido')
    if (!user) return
    run(async () => {
      await updateName(user.uid, trimmed)
      return 'Nome alterado com sucesso'
    })
  }

  return (
    <Dialog title="Alterar Nome" onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="settings-current">{profile?.nome}</p>
        <label>
          Novo nome
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <Feedback error={error} info={info} />
        <button type="submit" className="auth-form-submit" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </Dialog>
  )
}

function EmailDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { error, info, submitting, run, setError } = useSubmit()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) return setError('Formato de e-mail inválido')
    if (!user) return
    if (trimmed === user.email) return setError('Este já é o seu e-mail atual')
    run(async () => {
      await requestEmailChange(user, trimmed, password)
      return 'E-mail de confirmação enviado para o novo endereço! Verifique sua caixa de entrada.'
    })
  }

  return (
    <Dialog title="Alterar Email" onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="settings-current">{user?.email}</p>
        <label>
          Novo e-mail
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Senha atual
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <Feedback error={error} info={info} />
        <button type="submit" className="auth-form-submit" disabled={submitting}>
          {submitting ? 'Enviando…' : 'Salvar'}
        </button>
      </form>
    </Dialog>
  )
}

function PasswordDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const { error, info, submitting, run, setError } = useSubmit()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (next.length < 6) return setError('A senha deve ter pelo menos 6 caracteres')
    if (next !== confirm) return setError('Senhas diferentes')
    if (next === current) return setError('A nova senha deve ser diferente da atual')
    if (!user) return
    run(async () => {
      await changePassword(user, current, next)
      return 'Senha alterada com sucesso!'
    })
  }

  return (
    <Dialog title="Alterar Senha" onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Senha atual
          <input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
        </label>
        <label>
          Nova senha
          <input type="password" value={next} onChange={(event) => setNext(event.target.value)} required />
        </label>
        <label>
          Confirmar nova senha
          <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required />
        </label>
        <Feedback error={error} info={info} />
        <button type="submit" className="auth-form-submit" disabled={submitting}>
          {submitting ? 'Salvando…' : 'Salvar'}
        </button>
      </form>
    </Dialog>
  )
}

function PrivacyDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const uid = user?.uid
  const [header, setHeader] = useState('Carregando…')

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    loadTermsAcceptance(uid)
      .then(({ acceptedAt, version }) => {
        if (cancelled) return
        if (acceptedAt === null) return setHeader('Não foi possível confirmar a data exata do seu aceite.')
        const date = new Date(acceptedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
        setHeader(`Você aceitou este termo em ${date}${version ? ` (versão ${version}).` : '.'}`)
      })
      .catch(() => {
        if (!cancelled) setHeader('Não foi possível confirmar a data exata do seu aceite.')
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  return (
    <Dialog title="Políticas de Privacidade" onClose={onClose}>
      <p className="settings-current">{header}</p>
      <div className="auth-terms-box settings-terms" tabIndex={0}>
        {TERMS_BLOCKS.map((block, index) =>
          block.kind === 'text' ? (
            <p key={index}>{block.text}</p>
          ) : (
            <h4 key={index} className={block.kind}>
              {block.text}
            </h4>
          ),
        )}
      </div>
      <button type="button" className="auth-form-submit settings-close" onClick={onClose}>
        Fechar
      </button>
    </Dialog>
  )
}

function ExportDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const { error, info, submitting, run } = useSubmit()

  function exportAs(format: 'json' | 'pdf') {
    if (!user) return
    run(async () => {
      const data = await loadAllUserData(user.uid, user.email ?? '')
      if (format === 'json') {
        downloadFile(buildJson(data), exportFilename('json'), 'application/json')
      } else {
        downloadFile(await buildPdf(data), exportFilename('pdf'), 'application/pdf')
      }
      return 'Seus dados foram exportados com sucesso.'
    })
  }

  return (
    <Dialog title="Exportar Meus Dados" onClose={onClose}>
      <div className="auth-form">
        <p className="settings-current">Baixe uma cópia de todos os seus dados no Dinlux.</p>
        <button type="button" className="auth-form-submit" disabled={submitting} onClick={() => exportAs('json')}>
          Exportar em JSON
        </button>
        <button type="button" className="auth-form-submit" disabled={submitting} onClick={() => exportAs('pdf')}>
          Exportar em PDF
        </button>
        {submitting && <p className="settings-current">Gerando arquivo…</p>}
        <Feedback error={error} info={info} />
      </div>
    </Dialog>
  )
}

function DeleteDialog({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const { error, submitting, run } = useSubmit()

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user) return
    run(() => deleteAccount(user, password))
  }

  return (
    <Dialog title="Excluir Conta" onClose={onClose}>
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="settings-current">
          Todos os seus dados (bancos, cartões, simulações, extratos e avisos) serão apagados permanentemente. Essa
          ação não pode ser desfeita.
        </p>
        <label>
          Digite sua senha atual para confirmar
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        <Feedback error={error} info={null} />
        <button type="submit" className="auth-form-submit settings-danger" disabled={submitting}>
          {submitting ? 'Excluindo…' : 'Excluir conta'}
        </button>
        <button type="button" className="auth-form-link" onClick={onClose}>
          Cancelar
        </button>
      </form>
    </Dialog>
  )
}

export default function SettingsDialogs({ kind, onClose }: { kind: SettingsDialogKind; onClose: () => void }) {
  switch (kind) {
    case 'name':
      return <NameDialog onClose={onClose} />
    case 'email':
      return <EmailDialog onClose={onClose} />
    case 'password':
      return <PasswordDialog onClose={onClose} />
    case 'privacy':
      return <PrivacyDialog onClose={onClose} />
    case 'export':
      return <ExportDialog onClose={onClose} />
    case 'delete':
      return <DeleteDialog onClose={onClose} />
  }
}
