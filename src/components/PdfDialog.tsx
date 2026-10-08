'use client'

import {useEffect, useRef, useState} from 'react'

/**
 * Download-a-PDF sheet. A bottom sheet on phones, a centered dialog on wider
 * screens. The PDF is generated on request, so it is always current.
 */
export default function PdfDialog({
  title,
  baseUrl,
  shownKey,
  originalKey,
  footnote,
  hasCues = false,
  onClose,
}: {
  title: string
  baseUrl: string
  /** The key on screen when it differs from the original; null if not transposed */
  shownKey: string | null
  originalKey: string | null
  footnote?: string
  /** The reader has cues on this: offer to print them */
  hasCues?: boolean
  onClose: () => void
}) {
  const [useShown, setUseShown] = useState(Boolean(shownKey))
  const [paper, setPaper] = useState<'letter' | 'a4'>('letter')
  const [withCues, setWithCues] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const params = new URLSearchParams({download: '1', paper})
  if (useShown && shownKey) params.set('key', shownKey)
  if (withCues) params.set('cues', '1')
  const href = `${baseUrl}?${params}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
        tabIndex={-1}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-dialog-title"
        className="relative w-full max-w-md rounded-t-2xl border-t border-line-2 bg-panel px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-3 md:rounded-2xl md:border"
      >
        <div className="mx-auto mb-2 h-1.5 w-10 rounded bg-line-2 md:hidden" />
        <div className="flex items-center justify-between">
          <h2 id="pdf-dialog-title" className="text-xl font-extrabold">
            Download PDF
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center text-2xl"
          >
            ×
          </button>
        </div>
        <p className="mb-4 text-muted">{title}</p>

        {shownKey && (
          <Choice
            legend="Key"
            options={[
              ['shown', `As shown (${shownKey})`],
              ['original', `Original (${originalKey ?? '—'})`],
            ]}
            value={useShown ? 'shown' : 'original'}
            onChange={(v) => setUseShown(v === 'shown')}
          />
        )}
        <Choice
          legend="Paper"
          options={[
            ['letter', 'Letter'],
            ['a4', 'A4'],
          ]}
          value={paper}
          onChange={(v) => setPaper(v as 'letter' | 'a4')}
        />

        {hasCues && (
          <Choice
            legend="Your cues"
            options={[
              ['off', 'Leave off'],
              ['on', 'Print them'],
            ]}
            value={withCues ? 'on' : 'off'}
            onChange={(v) => setWithCues(v === 'on')}
          />
        )}

        {footnote && <p className="my-4 text-[13px] text-muted">{footnote}</p>}

        <a
          href={href}
          className="mt-2 flex min-h-13 items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-[17px] font-extrabold text-on-accent no-underline"
          onClick={() => setTimeout(onClose, 300)}
        >
          Download
        </a>
      </section>
    </div>
  )
}

function Choice({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: [string, string][]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">
        {legend}
      </legend>
      <div className="flex overflow-hidden rounded-lg border border-line-2">
        {options.map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`min-h-11 flex-1 px-3 ${value === v ? 'bg-text font-semibold text-ink' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
