'use client'

import {ReactNode, useEffect, useRef, useState} from 'react'

/**
 * A button that opens a small menu. It closes on a tap or click anywhere
 * outside it, on Escape, and after choosing any link or button inside it.
 */
export default function Dropdown({
  trigger,
  label,
  align = 'right',
  triggerClassName = '',
  panelClassName = 'w-56',
  children,
}: {
  trigger: ReactNode
  /** Accessible name when the trigger is only a symbol */
  label?: string
  /** Which edge of the trigger the menu lines up with */
  align?: 'left' | 'right'
  triggerClassName?: string
  panelClassName?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    // pointerdown, not click: iOS doesn't fire click on non-interactive
    // elements, so a tap on plain page background would otherwise be missed
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          onClick={(e) =>
            (e.target as Element).closest('a,button') && setOpen(false)
          }
          className={`absolute z-40 mt-1 rounded-xl border border-line-2 bg-panel p-1.5 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'} ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </div>
  )
}
