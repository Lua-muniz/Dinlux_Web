import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import './OptionSelect.css'

export type SelectOption = { id: string; title: string; subtitle?: string; color: string }

function OptionContent({ option }: { option: SelectOption }) {
  return (
    <>
      <i className="option-select-dot" style={{ background: option.color }} />
      <span className="option-select-text">
        <span>{option.title}</span>
        {option.subtitle && <small>{option.subtitle}</small>}
      </span>
    </>
  )
}

export default function OptionSelect({
  label,
  placeholder,
  emptyText,
  options,
  value,
  onChange,
}: {
  label: string
  placeholder: string
  emptyText: string
  options: SelectOption[]
  value: string | null
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.id === value) ?? null

  useEffect(() => {
    if (!open) return

    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setPosition({ top: rect.bottom + 6, left: rect.left, width: rect.width })
    setActiveIndex(Math.max(0, options.findIndex((option) => option.id === value)))

    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) return
      setOpen(false)
    }
    function dismiss(event: Event) {
      if (event.target instanceof Node && listRef.current?.contains(event.target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('scroll', dismiss, true)
      window.removeEventListener('resize', dismiss)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, activeIndex, position])

  function choose(option: SelectOption) {
    onChange(option.id)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (options.length === 0) return

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault()
        setOpen(true)
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((current) => (current + 1) % options.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((current) => (current - 1 + options.length) % options.length)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(options[activeIndex])
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="option-select">
      <button
        ref={triggerRef}
        type="button"
        className="option-select-trigger"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        disabled={options.length === 0}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleKeyDown}
      >
        {selected ? (
          <OptionContent option={selected} />
        ) : (
          <span className="option-select-placeholder">{options.length === 0 ? emptyText : placeholder}</span>
        )}
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        position &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="option-select-list"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {options.map((option, index) => (
              <li
                key={option.id}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={option.id === value}
                className={`option-select-option ${index === activeIndex ? 'active' : ''} ${option.id === value ? 'selected' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(option)}
              >
                <OptionContent option={option} />
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  )
}
