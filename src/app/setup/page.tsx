export const dynamic = 'force-dynamic'

import {redirect} from 'next/navigation'
import AuthCard from '@/components/AuthCard'
import SetupForm from '@/components/SetupForm'
import {needsSetup} from '@/lib/setup'
import {MIN_PASSWORD_LENGTH} from '@/lib/password'

export const metadata = {title: 'Set up Bandstand'}

/** A fresh install: the first band and its first admin, who runs the install. */
export default async function SetupPage() {
  if (!(await needsSetup())) redirect('/login')
  return (
    <AuthCard
      title="Set up Bandstand"
      intro="Your band, and your account. You’ll run this install: you can start more bands and add everyone else from inside."
    >
      <SetupForm minLength={MIN_PASSWORD_LENGTH} />
    </AuthCard>
  )
}
