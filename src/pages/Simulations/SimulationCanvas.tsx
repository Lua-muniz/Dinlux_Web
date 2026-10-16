import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent } from 'react'
import type { SimulationEntry } from '../../lib/dinluxData'
import type { SimulationGroup } from '../../lib/simulations'
import { buildCanvasLayout, isCompatibleGroup, CANVAS_GROUP_LABEL_RESERVE, CANVAS_NODE_TEXT_SIZE_TWO_LINES } from './canvasLayout'
import './SimulationCanvas.css'

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const DRAG_THRESHOLD_PX = 4
const TOUCH_DRAG_THRESHOLD_PX = 10

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
  const activePointers = useRef(new Map<number, { x: number; y: number }>())
  const pinchState = useRef<{ distance: number; scale: number; contentX: number; contentY: number } | null>(null)

  const nodeDragState = useRef<{
    entry: SimulationEntry
    startClientX: number
    startClientY: number
    threshold: number
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

    function handleMove(event: PointerEvent) {
      setDragPoint({ x: event.clientX, y: event.clientY })
      const state = nodeDragState.current
      if (!state) return
      if (!state.moved && Math.hypot(event.clientX - state.startClientX, event.clientY - state.startClientY) > state.threshold) {
        state.moved = true
      }
      const point = contentPointFromClient(event.clientX, event.clientY)
      const group = groupAtPoint(point.x, point.y)
      setDropTargetId(group && isCompatibleGroup(state.entry, group) ? group.id : null)
    }

    function handleUp(event: PointerEvent) {
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
      endNodeDrag()
    }

    function endNodeDrag() {
      nodeDragState.current = null
      setDraggingId(null)
      setDropTargetId(null)
      setDragPoint(null)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', endNodeDrag)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', endNodeDrag)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingId])

  function handleWheel(event: ReactWheelEvent) {
    event.preventDefault()
    const factor = event.deltaY > 0 ? 0.9 : 1.1
    setTransform((current) => ({ ...current, scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, current.scale * factor)) }))
  }

  function startPan(clientX: number, clientY: number) {
    const t = transformRef.current
    panState.current = { x: t.x, y: t.y, startX: clientX, startY: clientY }
  }

  function startPinch() {
    const [a, b] = [...activePointers.current.values()]
    const t = transformRef.current
    const center = contentPointFromClient((a.x + b.x) / 2, (a.y + b.y) / 2)
    panState.current = null
    pinchState.current = { distance: Math.hypot(a.x - b.x, a.y - b.y) || 1, scale: t.scale, contentX: center.x, contentY: center.y }
  }

  function handlePointerDown(event: ReactPointerEvent) {
    if ((event.target as HTMLElement).closest('.sim-node, .sim-group-label')) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    try {
      viewportRef.current?.setPointerCapture(event.pointerId)
    } catch {
      // Sem captura o gesto continua funcionando enquanto o dedo estiver sobre o canvas
    }
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (activePointers.current.size === 1) startPan(event.clientX, event.clientY)
    else if (activePointers.current.size === 2) startPinch()
  }

  function handlePointerMove(event: ReactPointerEvent) {
    if (!activePointers.current.has(event.pointerId)) return
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

    const pinch = pinchState.current
    if (pinch && activePointers.current.size >= 2) {
      const [a, b] = [...activePointers.current.values()]
      const rect = viewportRef.current?.getBoundingClientRect()
      if (!rect) return
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (pinch.scale * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.distance))
      const midX = (a.x + b.x) / 2 - rect.left
      const midY = (a.y + b.y) / 2 - rect.top
      setTransform({ scale, x: midX - pinch.contentX * scale, y: midY - pinch.contentY * scale })
      return
    }

    const state = panState.current
    if (!state) return
    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY
    setTransform((current) => ({ ...current, x: state.x + dx, y: state.y + dy }))
  }

  function handlePointerEnd(event: ReactPointerEvent) {
    if (!activePointers.current.delete(event.pointerId)) return
    pinchState.current = null
    const remaining = [...activePointers.current.values()]
    if (remaining.length === 1) startPan(remaining[0].x, remaining[0].y)
    else panState.current = null
  }

  function handleNodePointerDown(entry: SimulationEntry, event: ReactPointerEvent) {
    event.stopPropagation()
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target as Element
    if (target.hasPointerCapture?.(event.pointerId)) target.releasePointerCapture(event.pointerId)
    nodeDragState.current = {
      entry,
      startClientX: event.clientX,
      startClientY: event.clientY,
      threshold: event.pointerType === 'mouse' ? DRAG_THRESHOLD_PX : TOUCH_DRAG_THRESHOLD_PX,
      moved: false,
    }
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
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
              onPointerDown={(event) => handleNodePointerDown(node.entry, event)}
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
