import type { ReactNode } from 'react'
import '../AuthModal/AuthModal.css'
import '../SettingsDialogs/SettingsDialogs.css'

export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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
