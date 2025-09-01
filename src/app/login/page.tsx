'use client'
import {Card, CardContent, Typography, Alert, Stack} from '@mui/material'
import {useSearchParams} from 'next/navigation'
import GoogleSignInButton from '@/components/GoogleSignInButton'

function mapError(code?: string) {
  switch (code) {
    case 'OAuthSignin':
    case 'OAuthCallback':
    case 'OAuthAccountNotLinked':
    case 'Callback':
      return 'Google sign-in failed. Check the redirect URI and client credentials.'
    case 'AccessDenied':
      return 'Access denied. Your account may not be allowed.'
    case 'Configuration':
      return 'Auth configuration error.'
    case 'Verification':
      return 'Verification failed or token expired.'
    default:
      return code ? `Error: ${code}` : ''
  }
}

export default function LoginPage() {
  const params = useSearchParams()
  const errorCode = params.get('error') || undefined
  const msg = mapError(errorCode)

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5">Sign in to Monkee Wrench</Typography>
          {msg && (
            <Alert severity="error" role="alert">
              {msg}
            </Alert>
          )}
          <GoogleSignInButton callbackUrl="/setlist" />
        </Stack>
      </CardContent>
    </Card>
  )
}
