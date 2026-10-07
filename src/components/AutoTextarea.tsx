'use client'

import {TextareaHTMLAttributes, useLayoutEffect, useRef} from 'react'

/**
 * A textarea that grows with its content, so long notes are readable in
 * full instead of scrolling inside a one-line box. `singleLine` keeps it
 * one paragraph (Enter doesn't add a line), for titles.
 */
export default function AutoTextarea({
  singleLine = false,
  value,
  onKeyDown,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  singleLine?: boolean
  value: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onKeyDown={(e) => {
        if (singleLine && e.key === 'Enter') {
          e.preventDefault()
          e.currentTarget.blur()
        }
        onKeyDown?.(e)
      }}
      {...props}
      style={{resize: 'none', overflow: 'hidden', ...props.style}}
    />
  )
}
