import { useState, type FormEvent } from 'react'
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../../lib/firebase'
import { FirestoreCollections } from '../../lib/firestoreCollections'
import { mapAuthError } from '../../lib/authErrors'
import './AuthModal.css'

type Mode = 'login' | 'signup'

type AuthModalProps = {
  initialMode: Mode
  onClose: () => void
}

const TERMS_VERSION = 1

export default function AuthModal({ initialMode, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function resetFeedback() {
    setError(null)
    setInfo(null)
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    resetFeedback()
    setSubmitting(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
      onClose()
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSignup(e: FormEvent) {
    e.preventDefault()
    resetFeedback()
    if (!termsAccepted) {
      setError('É necessário aceitar os Termos de Privacidade para criar sua conta')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }
    setSubmitting(true)
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password)
      await setDoc(doc(db, FirestoreCollections.USERS, credential.user.uid), {
        nome: name,
        termsAccepted: true,
        termsAcceptedAt: Date.now(),
        termsVersion: TERMS_VERSION,
        boasVindasExibida: false,
      })
      onClose()
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleForgotPassword() {
    resetFeedback()
    if (!email) {
      setError('Informe seu e-mail para receber o link de recuperação')
      return
    }
    setSubmitting(true)
    try {
      await sendPasswordResetEmail(auth, email)
      setInfo('Enviamos um link de recuperação para o seu e-mail')
    } catch (err) {
      setError(mapAuthError(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>

        <img className="auth-modal-logo" src="/favicon.png" alt="Dinlux" />

        <div className="auth-modal-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login')
              resetFeedback()
            }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => {
              setMode('signup')
              resetFeedback()
            }}
          >
            Criar conta
          </button>
        </div>

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            {error && <p className="auth-form-error">{error}</p>}
            {info && <p className="auth-form-info">{info}</p>}

            <button type="submit" className="auth-form-submit" disabled={submitting}>
              {submitting ? 'Entrando…' : 'Entrar'}
            </button>
            <button type="button" className="auth-form-link" onClick={handleForgotPassword}>
              Esqueci minha senha
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSignup}>
            <label>
              Nome
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label>
              Senha
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            <label>
              Confirmar senha
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </label>
            <label className="auth-form-checkbox">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              Li e aceito os Termos de Privacidade
            </label>

            {error && <p className="auth-form-error">{error}</p>}

            <button type="submit" className="auth-form-submit" disabled={submitting}>
              {submitting ? 'Criando conta…' : 'Criar conta'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
