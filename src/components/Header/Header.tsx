import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import AuthModal from '../AuthModal/AuthModal'
import logo from '../../assets/logo.png'
import './Header.css'

export default function Header() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null)

  function handleLogout() {
    signOut(auth)
    navigate('/')
    setMenuOpen(false)
  }

  return (
    <>
      <header className="site-header">
        <div className="container site-header-inner">
          <a className="site-header-brand" href="/">
            <img src={logo} alt="Dinlux" />
            <span>Dinlux</span>
          </a>

          <button
            type="button"
            className="site-header-toggle"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>

          <div className={`site-header-menu ${menuOpen ? 'open' : ''}`}>
            <nav className="site-header-nav">
              <a href="#recursos" onClick={() => setMenuOpen(false)}>
                Recursos
              </a>
              <a href="#download" onClick={() => setMenuOpen(false)}>
                Baixar
              </a>
            </nav>

            <div className="site-header-actions">
              {user ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      navigate('/painel')
                      setMenuOpen(false)
                    }}
                  >
                    {profile?.nome ? `Olá, ${profile.nome.split(' ')[0]}` : 'Painel'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={handleLogout}>
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setAuthMode('login')
                      setMenuOpen(false)
                    }}
                  >
                    Entrar
                  </button>
                  <button
                    type="button"
                    className="btn btn-solid"
                    onClick={() => {
                      setAuthMode('signup')
                      setMenuOpen(false)
                    }}
                  >
                    Criar conta
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {authMode && <AuthModal initialMode={authMode} onClose={() => setAuthMode(null)} />}
    </>
  )
}
