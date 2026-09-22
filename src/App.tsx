import { Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing/Landing'
import PanelLayout from './components/PanelLayout/PanelLayout'
import Home from './pages/Home/Home'
import Finance from './pages/Finance/Finance'
import Simulations from './pages/Simulations/Simulations'
import Listas from './pages/Listas/Listas'
import ImportExtrato from './pages/ImportExtrato/ImportExtrato'
import Avisos from './pages/Avisos/Avisos'
import Tutorial from './pages/Tutorial/Tutorial'
import PanelSection from './pages/Panel/PanelSection'
import { PANEL_SECTIONS } from './components/PanelLayout/sections'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/painel" element={<PanelLayout />}>
        {PANEL_SECTIONS.map((section) =>
          section.path === '' ? (
            <Route key="home" index element={<Home />} />
          ) : (
            <Route
              key={section.path}
              path={section.path}
              element={
                section.path === 'financas' ? (
                  <Finance />
                ) : section.path === 'simulacoes' ? (
                  <Simulations />
                ) : section.path === 'listas' ? (
                  <Listas />
                ) : section.path === 'extrato' ? (
                  <ImportExtrato />
                ) : section.path === 'avisos' ? (
                  <Avisos />
                ) : section.path === 'tutorial' ? (
                  <Tutorial />
                ) : (
                  <PanelSection path={section.path} />
                )
              }
            />
          ),
        )}
      </Route>
    </Routes>
  )
}
