import { Route, Routes } from 'react-router-dom'
import Header from './components/Header/Header'
import Landing from './pages/Landing/Landing'
import Dashboard from './pages/Dashboard/Dashboard'

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/painel" element={<Dashboard />} />
      </Routes>
    </>
  )
}
