export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {findEmailToken} from '@/lib/email-tokens'
import {mailConfigured} from '@/lib/mail'
import {MIN_PASSWORD_LENGTH} from '@/lib/password'
import AuthCard from '@/components/AuthCard'
import SetPasswordForm from '@/components/SetPasswordForm'

export const metadata = {title: 'Choose your password'}

/** Where the emailed links (welcome, invite, reset) land. */
export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: {token?: string}
}) {
  const token = searchParams.token ?? ''
  const row = await findEmailToken(token)
  if (!row?.user.email)
    return (
      <AuthCard
        title="This link has expired"
        intro="Each link works once, and not for long. Ask for a fresh one."
      >
        <p className="mt-6 text-sm text-faint">
          {mailConfigured() && (
            <>
              <Link href="/forgot" className="text-sky">
                Email me a new link
              </Link>{' '}
              ·{' '}
            </>
          )}
          <Link href="/login" className="text-sky">
            Sign in
          </Link>
        </p>
      </AuthCard>
    )
  return (
    <AuthCard
      title={
        row.kind === 'RESET' ? 'Choose a new password' : 'Choose your password'
      }
      intro={
        <>
          For <strong className="text-text">{row.user.email}</strong>.
        </>
      }
    >
      <SetPasswordForm
        token={token}
        email={row.user.email}
        minLength={MIN_PASSWORD_LENGTH}
      />
    </AuthCard>
  )
}
