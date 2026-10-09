export const dynamic = 'force-dynamic'

import Link from 'next/link'
import {notFound} from 'next/navigation'
import {mailConfigured} from '@/lib/mail'
import AuthCard from '@/components/AuthCard'
import ForgotForm from '@/components/ForgotForm'

export const metadata = {title: 'Forgot your password?'}

/** Needs email; without it, admins hand out new passwords instead. */
export default function ForgotPage() {
  if (!mailConfigured()) notFound()
  return (
    <AuthCard
      title="Forgot your password?"
      intro="We’ll email you a link to choose a new one."
    >
      <ForgotForm />
      <p className="mt-5 text-sm text-faint">
        <Link href="/login" className="text-sky">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  )
}
