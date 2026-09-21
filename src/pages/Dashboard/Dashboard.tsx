import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import './Dashboard.css'

export default function Dashboard() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <div className="dashboard-loading">Carregando…</div>
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return (
    <main className="dashboard-placeholder">
      <div className="container">
        <h1>Bem-vindo(a){profile?.nome ? `, ${profile.nome}` : ''}!</h1>
        <p>
          O painel com o menu lateral, gráficos, simulações, movimentações e cartões será
          construído nas próximas etapas.
        </p>
      </div>
    </main>
  )
}
