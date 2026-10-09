import Link from 'next/link'

/** Says the page is the tour's sample, not the band's. */
export default function DemoBanner({what}: {what: string}) {
  return (
    <p className="mx-auto mt-3 max-w-[1400px] px-4 md:px-7">
      <span className="block rounded-lg border border-sky/50 bg-panel px-4 py-2 text-sm text-muted">
        A sample {what} for the tour — not one of your band’s.{' '}
        <Link href="/songs" className="text-sky">
          Back to your songs
        </Link>
      </span>
    </p>
  )
}
