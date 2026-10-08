'use client'

import {useState} from 'react'
import PdfDialog from '@/components/PdfDialog'

export default function SetlistPdfButton({
  id,
  name,
  count,
}: {
  id: string
  name: string
  count: number
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-11 rounded-lg border border-line-2 px-4"
      >
        PDF of the set
      </button>
      {open && (
        <PdfDialog
          title={`${name} — ${count} charts in set order, each in its set key`}
          baseUrl={`/api/setlists/${id}/pdf`}
          shownKey={null}
          originalKey={null}
          hasCues
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
