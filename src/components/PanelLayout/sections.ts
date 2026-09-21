export type PanelSection = {
  path: string
  label: string
  icon: string
}

export const PANEL_SECTIONS: PanelSection[] = [
  { path: '', label: 'Home', icon: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { path: 'financas', label: 'Finanças', icon: 'M3 7h18v12H3zM3 7l2-3h14l2 3M16 13h2' },
  { path: 'simulacoes', label: 'Simulações', icon: 'M4 19V9M10 19V5M16 19v-7M22 19H2' },
  { path: 'listas', label: 'Listas', icon: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01' },
  { path: 'extrato', label: 'Importar Extrato', icon: 'M12 3v12m0 0-4-4m4 4 4-4M4 20h16' },
  { path: 'avisos', label: 'Avisos', icon: 'M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0' },
  { path: 'tutorial', label: 'Tutorial', icon: 'M12 17v.01M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18' },
]
