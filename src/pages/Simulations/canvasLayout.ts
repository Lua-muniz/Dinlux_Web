import type { SimulationEntry } from '../../lib/dinluxData'
import type { SimulationGroup } from '../../lib/simulations'
import { MAX_NODES_PER_GROUP } from '../../lib/simulations'

const COLUMNS = 3
const MIN_NODE_SIZE = 56
const MAX_NODE_SIZE = 104
const NODE_TEXT_SIZE = 11
const NODE_TEXT_SIZE_TWO_LINES = 9.5
const NODE_PADDING = 12
const NODE_ORBIT_BASE = 70
const NODE_GAP = 16
const CLUSTER_GAP = 40
const BASE_CLUSTER_SPACING = 220
const GROUP_LABEL_RESERVE = 40

let measureCtx: CanvasRenderingContext2D | null = null

function measureTextWidth(text: string): number {
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')
  }
  if (!measureCtx) return text.length * 7
  measureCtx.font = `${NODE_TEXT_SIZE}px 'Segoe UI', Roboto, sans-serif`
  return measureCtx.measureText(text).width
}

export type NodeLayout = { diameter: number; twoLines: boolean }

function measureNode(title: string): NodeLayout {
  const textWidth = measureTextWidth(title)
  const padding = NODE_PADDING * 2
  const oneLine = textWidth + padding
  if (oneLine <= MAX_NODE_SIZE) {
    return { diameter: Math.max(oneLine, MIN_NODE_SIZE), twoLines: false }
  }
  return { diameter: MAX_NODE_SIZE, twoLines: true }
}

export type LaidOutNode = {
  entry: SimulationEntry
  x: number
  y: number
  diameter: number
  twoLines: boolean
}

export type LaidOutGroup = {
  group: SimulationGroup
  centerX: number
  centerY: number
  clusterRadius: number
  color: string
  nodes: LaidOutNode[]
}

export type LaidOutEdge = { x1: number; y1: number; x2: number; y2: number; color: string; fromId: string; toId: string }

export type CanvasLayout = {
  width: number
  height: number
  groups: LaidOutGroup[]
  edges: LaidOutEdge[]
}

export function buildCanvasLayout(
  groups: SimulationGroup[],
  entries: SimulationEntry[],
  colorFor: (id: string) => string,
): CanvasLayout {
  if (groups.length === 0) return { width: 0, height: 0, groups: [], edges: [] }

  const entriesByGroup = new Map<string, SimulationEntry[]>()
  for (const entry of entries) {
    entriesByGroup.set(entry.groupId, [...(entriesByGroup.get(entry.groupId) ?? []), entry])
  }

  const computed = groups.map((group) => {
    const groupEntries = entriesByGroup.get(group.id) ?? []
    const layouts = new Map(groupEntries.map((entry) => [entry.id, measureNode(entry.title)]))
    const maxDiameter = Math.max(MIN_NODE_SIZE, ...[...layouts.values()].map((l) => l.diameter))
    const orbitRadius = groupEntries.length <= 1 ? 0 : Math.max(NODE_ORBIT_BASE, maxDiameter + NODE_GAP)
    const clusterRadius = orbitRadius + maxDiameter / 2
    return { group, entries: groupEntries, layouts, orbitRadius, clusterRadius }
  })

  const maxClusterRadius = Math.max(NODE_ORBIT_BASE, ...computed.map((c) => c.clusterRadius))
  const spacing = Math.max(BASE_CLUSTER_SPACING, 2 * maxClusterRadius + CLUSTER_GAP + GROUP_LABEL_RESERVE)

  const rows = Math.ceil(groups.length / COLUMNS)
  const width = spacing * COLUMNS
  const height = spacing * rows

  const laidOutGroups: LaidOutGroup[] = []
  const edges: LaidOutEdge[] = []

  computed.forEach((item, index) => {
    const col = index % COLUMNS
    const row = Math.floor(index / COLUMNS)
    const centerX = col * spacing + spacing / 2
    const centerY = row * spacing + spacing / 2
    const color = colorFor(item.group.cardId || item.group.bankId)

    const angleStep = item.entries.length === 0 ? 0 : (2 * Math.PI) / item.entries.length
    const nodes: LaidOutNode[] = item.entries.map((entry, nodeIndex) => {
      const angle = -Math.PI / 2 + angleStep * nodeIndex
      const layout = item.layouts.get(entry.id)!
      return {
        entry,
        x: centerX + item.orbitRadius * Math.cos(angle),
        y: centerY + item.orbitRadius * Math.sin(angle),
        diameter: layout.diameter,
        twoLines: layout.twoLines,
      }
    })

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        edges.push({
          x1: nodes[i].x,
          y1: nodes[i].y,
          x2: nodes[j].x,
          y2: nodes[j].y,
          color,
          fromId: nodes[i].entry.id,
          toId: nodes[j].entry.id,
        })
      }
    }

    laidOutGroups.push({ group: item.group, centerX, centerY, clusterRadius: item.clusterRadius, color, nodes })
  })

  return { width, height, groups: laidOutGroups, edges }
}

export function isCompatibleGroup(entry: SimulationEntry, group: SimulationGroup): boolean {
  return (
    group.id !== entry.groupId &&
    group.bankId === entry.bankId &&
    group.cardId === entry.cardId &&
    group.entryType === entry.type &&
    group.nodeCount < MAX_NODES_PER_GROUP
  )
}

export const CANVAS_NODE_TEXT_SIZE_TWO_LINES = NODE_TEXT_SIZE_TWO_LINES
export const CANVAS_GROUP_LABEL_RESERVE = GROUP_LABEL_RESERVE
