import { PANEL_SECTIONS } from '../../components/PanelLayout/sections'

export default function PanelSection({ path }: { path: string }) {
  const section = PANEL_SECTIONS.find((item) => item.path === path)

  return (
    <div>
      <h1>{section?.label}</h1>
      <p style={{ opacity: 0.7, marginTop: 8 }}>Em construção.</p>
    </div>
  )
}
