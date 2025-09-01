'use client'
import {Button} from '@mui/material'
import {signIn} from 'next-auth/react'

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.6 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C33.8 6 29.2 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c10.4 0 19-8.4 19-19 0-1.3-.1-2.2-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.8 16.5 19.1 14 24 14c3.1 0 5.9 1.2 8 3.1l5.7-5.7C33.8 6 29.2 4 24 4 16.5 4 9.9 8.1 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.3-5.2l-6.1-5c-2 1.4-4.6 2.2-7.2 2.2-5.3 0-9.7-3.6-11.3-8.5l-6.6 5.1C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.4 5.8-6.3 7.4l6.1 5C38.6 38.8 41 32.8 41 25c0-1.3-.1-2.9-.4-4.5z"
      />
    </svg>
  )
}

export default function GoogleSignInButton({
  callbackUrl = '/setlist',
}: {
  callbackUrl?: string
}) {
  return (
    <Button
      onClick={() => signIn('google', {callbackUrl})}
      variant="contained"
      disableElevation
      sx={{
        textTransform: 'none',
        bgcolor: '#ffffff',
        color: '#000000',
        border: '1px solid rgba(0,0,0,0.12)',
        boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
        '&:hover': {bgcolor: '#f5f5f5'},
        gap: 1.5,
        px: 2,
        py: 1,
      }}
      startIcon={<GoogleG />}
    >
      Sign in with Google
    </Button>
  )
}
