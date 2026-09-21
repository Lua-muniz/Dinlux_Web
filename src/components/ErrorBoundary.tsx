import { Component, type ErrorInfo, type ReactNode } from 'react'

type State = { error: Error | null }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro de renderização:', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <main style={{ padding: 24 }}>
        <h1>Algo deu errado</h1>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>
          {error.message}
          {'\n\n'}
          {error.stack}
        </pre>
      </main>
    )
  }
}
