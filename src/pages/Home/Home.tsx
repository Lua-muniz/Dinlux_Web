import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { BarChart, DonutChart, formatCurrency, LineChart, PieChart } from '../../components/Charts/Charts'
import { colorFor, resolveColors } from '../../lib/entityColors'
import {
  loadCardsChart,
  loadMovementsChart,
  loadSimulationsChart,
  type BankPie,
  type CardDonut,
  type SimulationSection,
} from '../../lib/dashboardData'
import './Home.css'

type Tab = 'simulacoes' | 'movimentacoes' | 'cartoes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'simulacoes', label: 'Simulações' },
  { id: 'movimentacoes', label: 'Movimentações' },
  { id: 'cartoes', label: 'Cartões' },
]

type Loaded<T> = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }

function useLoaded<T>(load: (uid: string) => Promise<T>): Loaded<T> {
  const { user } = useAuth()
  const uid = user?.uid
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' })

  useEffect(() => {
    if (!uid) return
    let cancelled = false
    load(uid)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' })
      })
    return () => {
      cancelled = true
    }
  }, [uid, load])

  return state
}

function Status<T>({ state, empty, children }: { state: Loaded<T>; empty: (data: T) => boolean; children: (data: T) => React.ReactNode }) {
  if (state.status === 'loading') return <p className="home-status">Carregando…</p>
  if (state.status === 'error') return <p className="home-status">Não foi possível carregar os dados.</p>
  if (empty(state.data)) return <p className="home-status">Nada por aqui ainda.</p>
  return <>{children(state.data)}</>
}

function ChartCard({ title, subtitle, color, children }: { title?: string; subtitle?: string; color?: string; children: React.ReactNode }) {
  return (
    <div className="home-card">
      {title && (
        <div className="home-card-title">
          {color && <i style={{ background: color }} />}
          <strong>{title}</strong>
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

function SimulationsTab() {
  const state = useLoaded(loadSimulationsChart)

  return (
    <Status state={state} empty={(sections: SimulationSection[]) => sections.length === 0}>
      {(sections) => <SimulationsContent sections={sections} />}
    </Status>
  )
}

function SimulationsContent({ sections }: { sections: SimulationSection[] }) {
  const colors = useMemo(
    () => resolveColors(sections.flatMap((section) => section.charts.map((chart) => chart.colorSourceId))),
    [sections],
  )

  return (
    <>
      <div className="home-card home-card-wide">
        <div className="home-card-title">
          <strong>Progresso Geral</strong>
        </div>
        <LineChart entries={sections.map((section) => ({ label: section.title, progress: section.overallProgress }))} />
      </div>

      {sections.filter((section) => section.hasEntries).map((section, index) => (
        <section key={index} className="home-section">
          <h2>{section.title}</h2>
          <div className="home-grid">
            {section.charts.map((chart, chartIndex) => {
              const color = colorFor(colors, chart.colorSourceId)
              return (
                <ChartCard key={chartIndex} title={chart.label} color={color}>
                  <BarChart entries={chart.entries} color={color} />
                </ChartCard>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}

function MovementsTab() {
  const state = useLoaded(loadMovementsChart)

  return (
    <Status state={state} empty={(pies: BankPie[]) => pies.length === 0}>
      {(pies) => <MovementsContent pies={pies} />}
    </Status>
  )
}

function MovementsContent({ pies }: { pies: BankPie[] }) {
  const colors = useMemo(() => resolveColors(pies.map((pie) => pie.colorSourceId)), [pies])

  return (
    <div className="home-grid">
      {pies.map((pie) => (
        <ChartCard key={pie.colorSourceId} title={pie.bankName} color={colorFor(colors, pie.colorSourceId)}>
          <PieChart income={pie.income} expense={pie.expense} />
        </ChartCard>
      ))}
    </div>
  )
}

function CardsTab() {
  const state = useLoaded(loadCardsChart)

  return (
    <Status state={state} empty={(cards: CardDonut[]) => cards.length === 0}>
      {(cards) => <CardsContent cards={cards} />}
    </Status>
  )
}

function CardsContent({ cards }: { cards: CardDonut[] }) {
  const colors = useMemo(() => resolveColors(cards.map((card) => card.colorSourceId)), [cards])

  return (
    <div className="home-grid">
      {cards.map((card) => {
        const total = card.used + card.available
        const usedPercent = total > 0 ? Math.round((card.used / total) * 100) : 0
        const availablePercent = total > 0 ? 100 - usedPercent : 100
        return (
          <ChartCard
            key={card.colorSourceId}
            title={card.cardLabel}
            subtitle={card.bankName}
            color={colorFor(colors, card.colorSourceId)}
          >
            <div className="home-donut">
              <DonutChart used={card.used} available={card.available} />
              <div className="home-donut-dates">
                <span>Fechamento: dia {card.closingDay}</span>
                <span>Vencimento: dia {card.dueDay}</span>
              </div>
            </div>
            <div className="chart-legend home-donut-legend">
              <span>
                <i style={{ background: 'var(--color-expense)' }} />
                {`Usado: ${formatCurrency(card.used)} (${usedPercent}%)`}
              </span>
              <span>
                <i style={{ background: 'var(--color-income)' }} />
                {`Disponível: ${formatCurrency(card.available)} (${availablePercent}%)`}
              </span>
            </div>
          </ChartCard>
        )
      })}
    </div>
  )
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('simulacoes')

  return (
    <div className="home">
      <div className="home-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'active' : ''}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'simulacoes' && <SimulationsTab />}
      {tab === 'movimentacoes' && <MovementsTab />}
      {tab === 'cartoes' && <CardsTab />}
    </div>
  )
}
