import { useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../../lib/firebase'
import { useAuth } from '../../context/AuthContext'
import { loadUnseenAlertsTotal } from '../../lib/avisos'
import { syncEmailWithAuth } from '../../lib/account'
import SettingsDialogs, { type SettingsDialogKind } from '../SettingsDialogs/SettingsDialogs'
import icon from '../../assets/icon.png'
import { PANEL_SECTIONS } from './sections'
import './PanelLayout.css'

const SETTINGS_ITEMS: { kind: SettingsDialogKind; label: string }[] = [
  { kind: 'name', label: 'Alterar Nome' },
  { kind: 'email', label: 'Alterar Email' },
  { kind: 'password', label: 'Alterar Senha' },
  { kind: 'privacy', label: 'Políticas de Privacidade' },
  { kind: 'export', label: 'Exportar Meus Dados' },
]

const GEAR_PATH =
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'

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

export default function PanelLayout() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const [unseenAlerts, setUnseenAlerts] = useState(0)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dialog, setDialog] = useState<SettingsDialogKind | null>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  const uid = user?.uid

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    loadUnseenAlertsTotal(uid)
      .then((total) => {
        if (!cancelled) setUnseenAlerts(total)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [uid, pathname])

  useEffect(() => {
    if (user) syncEmailWithAuth(user).catch(() => {})
  }, [user])

  useEffect(() => {
    if (!settingsOpen) return
    function handleClick(event: MouseEvent) {
      if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [settingsOpen])

  function openDialog(kind: SettingsDialogKind) {
    setSettingsOpen(false)
    setDialog(kind)
  }

  if (loading) {
    return <div className="panel-loading">Carregando…</div>
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="panel">
      <aside className={`panel-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <a className="panel-brand" href="/painel">
          <img src={icon} alt="" />
          <span>Dinlux</span>
        </a>
        <nav className="panel-nav">
          {PANEL_SECTIONS.map((section) => (
            <NavLink
              key={section.path}
              to={`/painel/${section.path}`}
              end={section.path === ''}
              className={({ isActive }) => `panel-nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon d={section.icon} />
              <span>{section.label}</span>
              {section.path === 'avisos' && unseenAlerts > 0 && (
                <span className="panel-nav-badge">{unseenAlerts}</span>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>
      {sidebarOpen && <div className="panel-backdrop" onClick={() => setSidebarOpen(false)} />}

      <div className="panel-main">
        <header className="panel-topbar">
          <button
            type="button"
            className="panel-menu-toggle"
            aria-label="Abrir menu"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon d="M4 6h16M4 12h16M4 18h16" />
          </button>

          <div className="panel-topbar-actions">
            <div className="panel-settings" ref={settingsRef}>
              <button
                type="button"
                className="panel-icon-button"
                aria-label="Configurações"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen((open) => !open)}
              >
                <Icon d={GEAR_PATH} />
              </button>
              {settingsOpen && (
                <div className="panel-settings-menu" role="menu">
                  {SETTINGS_ITEMS.map((item) => (
                    <button key={item.kind} type="button" role="menuitem" onClick={() => openDialog(item.kind)}>
                      {item.label}
                    </button>
                  ))}
                  <hr />
                  <button type="button" role="menuitem" className="danger" onClick={() => openDialog('delete')}>
                    Excluir Conta
                  </button>
                </div>
              )}
            </div>

            <button type="button" className="panel-exit" onClick={() => signOut(auth)}>
              Sair
            </button>
          </div>
        </header>

        <main className="panel-content">
          <Outlet />
        </main>
      </div>

      {dialog && <SettingsDialogs kind={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
