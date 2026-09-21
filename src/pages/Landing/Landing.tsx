import { useState } from 'react'
import logo from '../../assets/logo.png'
import AuthModal from '../../components/AuthModal/AuthModal'
import { useAuth } from '../../context/AuthContext'
import './Landing.css'

const APK_DOWNLOAD_URL = '#'

const FEATURES = [
  { title: 'Contas e cartões', color: 'var(--color-cyan)' },
  { title: 'Extratos', color: 'var(--color-sky-blue)' },
  { title: 'Simulações', color: 'var(--color-income)' },
  { title: 'Listas', color: 'var(--color-warning)' },
  { title: 'Avisos', color: 'var(--color-alert-red)' },
]

export default function Landing() {
  const { user } = useAuth()
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null)

  return (
    <main className="landing">
      <section className="landing-hero">
        <div className="container landing-hero-inner">
          <img className="landing-hero-logo" src={logo} alt="Dinlux" />
          <h1>Dinlux</h1>
          <p className="landing-hero-subtitle">
            Organize suas finanças pessoais em um só lugar.
          </p>
          <div className="landing-hero-actions">
            {!user && (
              <button type="button" className="btn btn-solid" onClick={() => setAuthMode('signup')}>
                Criar conta grátis
              </button>
            )}
            <a className="btn btn-outline" href="#download">
              Baixar o app
            </a>
          </div>
        </div>
      </section>

      <section id="recursos" className="landing-features">
        <div className="container">
          <h2>Recursos</h2>
          <div className="landing-features-grid">
            {FEATURES.map((feature) => (
              <div className="landing-feature-card" key={feature.title}>
                <span className="landing-feature-dot" style={{ background: feature.color }} />
                <h3>{feature.title}</h3>
                <p>Texto em breve.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="download" className="landing-download">
        <div className="container landing-download-inner">
          <div>
            <h2>Disponível para Android</h2>
            <p>Baixe o aplicativo e leve o Dinlux com você.</p>
          </div>
          <a className="btn btn-solid" href={APK_DOWNLOAD_URL} download>
            Baixar para Android
          </a>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="container">
          <p>Dinlux · Projeto acadêmico (TCC)</p>
        </div>
      </footer>

      {authMode && <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} />}
    </main>
  )
}
