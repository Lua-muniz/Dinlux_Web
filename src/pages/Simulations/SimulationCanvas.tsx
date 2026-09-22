import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent } from 'react'
import type { SimulationEntry } from '../../lib/dinluxData'
import type { SimulationGroup } from '../../lib/simulations'
import { buildCanvasLayout, isCompatibleGroup, CANVAS_GROUP_LABEL_RESERVE, CANVAS_NODE_TEXT_SIZE_TWO_LINES } from './canvasLayout'
import './SimulationCanvas.css'

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const DRAG_THRESHOLD_PX = 4

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
  const viewportRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ scale: 1, x: 40, y: 20 })
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const panState = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null)

  const nodeDragState = useRef<{
    entry: SimulationEntry
    startClientX: number
    startClientY: number
    moved: boolean
  } | null>(null)

  const layout = buildCanvasLayout(groups, entries, colorFor)
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const transformRef = useRef(transform)
  transformRef.current = transform

  function contentPointFromClient(clientX: number, clientY: number) {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const t = transformRef.current
    return {
      x: (clientX - rect.left - t.x) / t.scale,
      y: (clientY - rect.top - t.y) / t.scale,
    }
  }

  function groupAtPoint(x: number, y: number): SimulationGroup | null {
    for (const laidOutGroup of layoutRef.current.groups) {
      const dx = x - laidOutGroup.centerX
      const dy = y - laidOutGroup.centerY
      if (dx * dx + dy * dy <= laidOutGroup.clusterRadius * laidOutGroup.clusterRadius) {
        return laidOutGroup.group
      }
    }
    return null
  }

  useEffect(() => {
    if (!draggingId) return

    function handleMove(event: MouseEvent) {
      setDragPoint({ x: event.clientX, y: event.clientY })
      const state = nodeDragState.current
      if (!state) return
      if (!state.moved && Math.hypot(event.clientX - state.startClientX, event.clientY - state.startClientY) > DRAG_THRESHOLD_PX) {
        state.moved = true
      }
      const point = contentPointFromClient(event.clientX, event.clientY)
      const group = groupAtPoint(point.x, point.y)
      setDropTargetId(group && isCompatibleGroup(state.entry, group) ? group.id : null)
    }

    function handleUp(event: MouseEvent) {
      const state = nodeDragState.current
      if (state) {
        const point = contentPointFromClient(event.clientX, event.clientY)
        const group = groupAtPoint(point.x, point.y)
        if (group && isCompatibleGroup(state.entry, group)) {
          onNodeMoved(state.entry, group)
        } else if (!state.moved) {
          onNodeClick(state.entry)
        }
      }
      nodeDragState.current = null
      setDraggingId(null)
      setDropTargetId(null)
      setDragPoint(null)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId])

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

  function handleNodeMouseDown(entry: SimulationEntry, event: ReactMouseEvent) {
    event.stopPropagation()
    if (event.button !== 0) return
    nodeDragState.current = { entry, startClientX: event.clientX, startClientY: event.clientY, moved: false }
    setDraggingId(entry.id)
    setDragPoint({ x: event.clientX, y: event.clientY })
  }

  const draggingNode = layout.groups.flatMap((g) => g.nodes).find((node) => node.entry.id === draggingId)
  const viewportRect = viewportRef.current?.getBoundingClientRect()
  const ghostPoint =
    dragPoint && viewportRect ? { x: dragPoint.x - viewportRect.left, y: dragPoint.y - viewportRect.top } : null

  return (
    <div
      ref={viewportRef}
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
              onMouseDown={(event) => handleNodeMouseDown(node.entry, event)}
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

      {draggingNode && ghostPoint && (
        <div
          className="sim-node sim-node-ghost"
          style={{
            left: ghostPoint.x - draggingNode.diameter / 2,
            top: ghostPoint.y - draggingNode.diameter / 2,
            width: draggingNode.diameter,
            height: draggingNode.diameter,
            background: layout.groups.find((g) => g.nodes.includes(draggingNode))?.color,
          }}
        >
          <span style={{ fontSize: draggingNode.twoLines ? CANVAS_NODE_TEXT_SIZE_TWO_LINES : 11 }}>{draggingNode.entry.title}</span>
        </div>
      )}
    </div>
  )
}
