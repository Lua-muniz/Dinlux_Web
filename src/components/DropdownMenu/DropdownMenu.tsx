import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type DropdownMenuItem = { label: string; danger?: boolean; onSelect: () => void }

function Icon({ d, size, strokeWidth }: { d: string; size: number; strokeWidth: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

export default function DropdownMenu({
  label,
  icon,
  items,
  align = 'left',
  buttonClassName = 'finance-icon-button',
  iconSize = 20,
  iconStrokeWidth = 1.8,
}: {
  label: string
  icon: string
  items: DropdownMenuItem[]
  align?: 'left' | 'right'
  buttonClassName?: string
  iconSize?: number
  iconStrokeWidth?: number
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left?: number; right?: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      setPosition(
        align === 'right'
          ? { top: rect.bottom + 8, right: window.innerWidth - rect.right }
          : { top: rect.bottom + 8, left: rect.left },
      )
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as Node
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleDismiss() {
      setOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    window.addEventListener('scroll', handleDismiss, true)
    window.addEventListener('resize', handleDismiss)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      window.removeEventListener('scroll', handleDismiss, true)
      window.removeEventListener('resize', handleDismiss)
    }
  }, [open, align])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((current) => !current)
        }}
      >
        <Icon d={icon} size={iconSize} strokeWidth={iconStrokeWidth} />
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            className="panel-settings-menu dropdown-menu-portal"
            role="menu"
            style={{ position: 'fixed', top: position.top, left: position.left, right: position.right }}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={item.danger ? 'danger' : ''}
                onClick={(event) => {
                  event.stopPropagation()
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  )
}
