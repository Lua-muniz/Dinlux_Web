import { useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from 'react'
import type { SimulationEntry } from '../../lib/dinluxData'
import type { SimulationGroup } from '../../lib/simulations'
import { buildCanvasLayout, isCompatibleGroup, CANVAS_GROUP_LABEL_RESERVE, CANVAS_NODE_TEXT_SIZE_TWO_LINES } from './canvasLayout'
import './SimulationCanvas.css'

const MIN_SCALE = 0.5
const MAX_SCALE = 3

export default function SimulationCanvas({
  groups,
  entries,
  colorFor,
  onNodeClick,
  onGroupClick,
  onNodeMoved,
}: {
  groups: SimulationGroup[]
  entries: SimulationEntry[]
  colorFor: (id: string) => string
  onNodeClick: (entry: SimulationEntry) => void
  onGroupClick: (group: SimulationGroup) => void
  onNodeMoved: (entry: SimulationEntry, group: SimulationGroup) => void
}) {
  const [transform, setTransform] = useState({ scale: 1, x: 40, y: 20 })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const panState = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)
  const draggedEntry = useRef<SimulationEntry | null>(null)

  const layout = buildCanvasLayout(groups, entries, colorFor)

  function handleWheel(event: ReactWheelEvent) {
    event.preventDefault()
    const factor = event.deltaY > 0 ? 0.9 : 1.1
    setTransform((current) => ({ ...current, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor)) }))
  }

  function handleMouseDown(event: ReactMouseEvent) {
    if ((event.target as HTMLElement).closest('.sim-node, .sim-group-label')) return
    panState.current = { x: transform.x, y: transform.y, startX: event.clientX, startY: event.clientY }
  }

  function handleMouseMove(event: ReactMouseEvent) {
    const state = panState.current
    if (!state) return
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    setTransform((current) => ({ ...current, x: state.x + dx, y: state.y + dy }))
  }

  function endPan() {
    panState.current = null
  }

  function handleNodeDragStart(entry: SimulationEntry) {
    draggedEntry.current = entry
    setDraggingId(entry.id)
  }

  function handleNodeDragEnd() {
    draggedEntry.current = null
    setDraggingId(null)
    setDropTargetId(null)
  }

  function handleGroupDragOver(group: SimulationGroup, event: ReactMouseEvent) {
    event.preventDefault()
    if (draggedEntry.current && isCompatibleGroup(draggedEntry.current, group)) {
      setDropTargetId(group.id)
    }
  }

  function handleGroupDrop(group: SimulationGroup, event: ReactMouseEvent) {
    event.preventDefault()
    setDropTargetId(null)
    const entry = draggedEntry.current
    if (entry && isCompatibleGroup(entry, group)) {
      onNodeMoved(entry, group)
    }
  }

  return (
    <div
      className="sim-canvas-viewport"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={endPan}
      onMouseLeave={endPan}
    >
      <div
        className="sim-canvas-content"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
        }}
      >
        <svg className="sim-canvas-edges" width={layout.width} height={layout.height}>
          {layout.edges.map((edge, index) =>
            edge.fromId === draggingId || edge.toId === draggingId ? null : (
              <line key={index} x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2} stroke={edge.color} strokeWidth={2} opacity={0.55} />
            ),
          )}
        </svg>

        {layout.groups.map((laidOutGroup) => (
          <div
            key={laidOutGroup.group.id}
            className={`sim-group-drop ${dropTargetId === laidOutGroup.group.id ? 'active' : ''}`}
            style={{
              left: laidOutGroup.centerX - laidOutGroup.clusterRadius,
              top: laidOutGroup.centerY - laidOutGroup.clusterRadius,
              width: laidOutGroup.clusterRadius * 2,
              height: laidOutGroup.clusterRadius * 2,
            }}
            onDragOver={(event) => handleGroupDragOver(laidOutGroup.group, event)}
            onDragLeave={() => setDropTargetId((current) => (current === laidOutGroup.group.id ? null : current))}
            onDrop={(event) => handleGroupDrop(laidOutGroup.group, event)}
          />
        ))}

        {layout.groups.map((laidOutGroup) => (
          <button
            key={`label-${laidOutGroup.group.id}`}
            type="button"
            className="sim-group-label"
            style={{
              left: laidOutGroup.centerX - CANVAS_GROUP_LABEL_RESERVE,
              top: Math.max(0, laidOutGroup.centerY - laidOutGroup.clusterRadius - CANVAS_GROUP_LABEL_RESERVE),
            }}
            onClick={() => onGroupClick(laidOutGroup.group)}
          >
            {laidOutGroup.group.name}
          </button>
        ))}

        {layout.groups.flatMap((laidOutGroup) =>
          laidOutGroup.nodes.map((node) => (
            <div
              key={node.entry.id}
              className="sim-node"
              draggable
              onDragStart={() => handleNodeDragStart(node.entry)}
              onDragEnd={handleNodeDragEnd}
              onClick={() => onNodeClick(node.entry)}
              style={{
                left: node.x - node.diameter / 2,
                top: node.y - node.diameter / 2,
                width: node.diameter,
                height: node.diameter,
                background: laidOutGroup.color,
                visibility: draggingId === node.entry.id ? 'hidden' : 'visible',
              }}
            >
              <span style={{ fontSize: node.twoLines ? CANVAS_NODE_TEXT_SIZE_TWO_LINES : 11 }}>{node.entry.title}</span>
            </div>
          )),
        )}
      </div>
    </div>
  )
}
