import { useState } from 'react'
import icon from '../../assets/icon.png'
import './Header.css'

type HeaderProps = {
  onLogin: () => void
  onSignup: () => void
}

export default function Header({ onLogin, onSignup }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  function close() {
    setMenuOpen(false)
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-header-brand" href="/">
          <img src={icon} alt="Dinlux" />
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
            <a href="#recursos" onClick={close}>
              Recursos
            </a>
            <a href="#sobre" onClick={close}>
              Sobre
            </a>
            <a href="#download" onClick={close}>
              Baixar
            </a>
          </nav>

          <div className="site-header-actions">
            <button
              type="button"
              className="btn btn-ghost btn-bold"
              onClick={() => {
                onLogin()
                close()
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className="btn btn-solid"
              onClick={() => {
                onSignup()
                close()
              }}
            >
              Criar Conta
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
