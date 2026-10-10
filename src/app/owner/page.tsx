export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {pageOwner} from '@/lib/guard'
import TestEmail from '@/components/owner/TestEmail'

export const metadata = {title: 'Owner'}

/** Running this install: only its owner sees it. */
export default async function OwnerPage() {
  const {user} = await pageOwner()
  return (
    <main className="mx-auto max-w-5xl px-4 pb-12 pt-5">
      <h1 className="text-3xl font-extrabold">Owner</h1>
      <p className="mt-1 text-muted">Everything on this install.</p>

      <section aria-labelledby="email-h" className="mt-8">
        <h2
          id="email-h"
          className="text-xs font-bold uppercase tracking-widest text-muted"
        >
          Emails
        </h2>
        <TestEmail email={user.email ?? ''} />
      </section>

      <p className="mt-8 text-sm">
        <Link href="/bands/manage" className="text-sky">
          All bands and their web addresses ›
        </Link>
      </p>
    </main>
  )
}
