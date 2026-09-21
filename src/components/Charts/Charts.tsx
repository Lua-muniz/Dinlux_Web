import { useEffect, useRef, useState } from 'react'
import type { BarEntry } from '../../lib/dashboardData'
import './Charts.css'

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatCurrency(value: number): string {
  return currency.format(value)
}

const AXIS_LEVELS = Array.from({ length: 11 }, (_, index) => index * 10)

export function BarChart({ entries, color }: { entries: BarEntry[]; color: string }) {
  if (entries.length === 0) return <div className="chart-empty-track" />

  return (
    <div className="bar-chart">
      <div className="bar-chart-axis">
        {AXIS_LEVELS.map((level) => (
          <span key={level} style={{ bottom: `${level}%` }}>
            {level}%
          </span>
        ))}
      </div>
      <div className="bar-chart-plot">
        <div className="bar-chart-grid">
          {AXIS_LEVELS.map((level) => (
            <i key={level} style={{ bottom: `${level}%` }} />
          ))}
        </div>
        <div className="bar-chart-columns">
          {entries.map((entry, index) => {
            const proportion = entry.max > 0 ? Math.min(Math.max(entry.value / entry.max, 0), 1) : 0
            return (
              <div key={index} className="bar-chart-column" title={entry.label}>
                <div className={`bar-chart-track ${entry.highlighted ? 'highlighted' : ''}`}>
                  <div className="bar-chart-fill" style={{ height: `${proportion * 100}%`, background: color }} />
                </div>
                <span className="bar-chart-label">{entry.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function PieChart({ income, expense }: { income: number; expense: number }) {
  const total = income + expense
  const size = 120
  const radius = size / 2
  const angle = total > 0 ? (income / total) * 2 * Math.PI : 0

  function slice(start: number, end: number, fill: string) {
    if (end - start >= 2 * Math.PI - 1e-6) return <circle cx={radius} cy={radius} r={radius} fill={fill} />
    const x1 = radius + radius * Math.sin(start)
    const y1 = radius - radius * Math.cos(start)
    const x2 = radius + radius * Math.sin(end)
    const y2 = radius - radius * Math.cos(end)
    const large = end - start > Math.PI ? 1 : 0
    return <path d={`M${radius} ${radius} L${x1} ${y1} A${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`} fill={fill} />
  }

  return (
    <div className="pie-chart">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Entrada e saída">
        {total <= 0 ? (
          <circle cx={radius} cy={radius} r={radius} fill="var(--color-track-bg)" />
        ) : (
          <>
            {income > 0 && slice(0, angle, 'var(--color-income)')}
            {expense > 0 && slice(angle, 2 * Math.PI, 'var(--color-expense)')}
          </>
        )}
      </svg>
      <div className="chart-legend">
        <span>
          <i style={{ background: 'var(--color-income)' }} />
          {`Entrada: ${formatCurrency(income)}`}
        </span>
        <span>
          <i style={{ background: 'var(--color-expense)' }} />
          {`Saída: ${formatCurrency(expense)}`}
        </span>
      </div>
    </div>
  )
}

export function DonutChart({ used, available }: { used: number; available: number }) {
  const size = 90
  const stroke = 16
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const total = used + available
  const usedLength = total > 0 ? (used / total) * circumference : 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Limite usado e disponível">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`} fill="none" strokeWidth={stroke}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--color-income)" />
        {usedLength > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--color-expense)"
            strokeDasharray={`${usedLength} ${circumference}`}
          />
        )}
      </g>
    </svg>
  )
}

function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

export function LineChart({ entries }: { entries: { label: string; progress: number }[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>()

  if (entries.length === 0) return <div className="chart-empty-track" />

  const axisWidth = 40
  const marginLeft = 30
  const marginRight = 60
  const top = 14
  const height = 120
  const base = top + height
  const labelSpace = 60
  const count = entries.length
  const plotStart = axisWidth + marginLeft
  const plotWidth = Math.max(width - axisWidth - marginLeft - marginRight, 0)
  const xAt = (index: number) => (count === 1 ? plotStart + plotWidth / 2 : plotStart + (plotWidth * index) / (count - 1))
  const yAt = (progress: number) => base - height * Math.min(Math.max(progress, 0), 1)

  return (
    <div ref={ref} className="line-chart">
      {width > 0 && (
        <svg width={width} height={base + labelSpace} role="img" aria-label="Progresso geral das simulações">
          {AXIS_LEVELS.map((level) => (
            <g key={level}>
              <line
                x1={axisWidth}
                x2={width}
                y1={base - (height * level) / 100}
                y2={base - (height * level) / 100}
                className="line-chart-grid"
              />
              <text x={axisWidth - 6} y={base - (height * level) / 100 + 3} className="line-chart-axis" textAnchor="end">
                {level}%
              </text>
            </g>
          ))}
          {count > 1 && (
            <polyline
              points={entries.map((entry, index) => `${xAt(index)},${yAt(entry.progress)}`).join(' ')}
              className="line-chart-path"
            />
          )}
          {entries.map((entry, index) => (
            <g key={index}>
              <circle cx={xAt(index)} cy={yAt(entry.progress)} r={4} className="line-chart-dot" />
              <text
                x={xAt(index)}
                y={base + 14}
                className="line-chart-label"
                transform={`rotate(30 ${xAt(index)} ${base + 14})`}
              >
                {entry.label.length > 14 ? `${entry.label.slice(0, 13)}…` : entry.label}
              </text>
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}
