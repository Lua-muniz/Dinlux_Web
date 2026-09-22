import { Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing/Landing'
import PanelLayout from './components/PanelLayout/PanelLayout'
import Home from './pages/Home/Home'
import Finance from './pages/Finance/Finance'
import Simulations from './pages/Simulations/Simulations'
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
