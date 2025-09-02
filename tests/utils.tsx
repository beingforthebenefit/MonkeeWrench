import React, {ReactElement} from 'react'
import {render, RenderOptions} from '@testing-library/react'
import Providers from '@/components/Providers'
import type {Session} from 'next-auth'

type Options = RenderOptions & {session?: Session | null}

export function renderWithProviders(
  ui: ReactElement,
  {session = null, ...options}: Options = {},
) {
  function Wrapper({children}: {children: React.ReactNode}) {
    return <Providers session={session}>{children}</Providers>
  }
  return render(ui, {wrapper: Wrapper, ...options})
}

// Allow tests to configure next-auth's useSession via the global mock
export function setMockSession(val: any) {
  ;(globalThis as any).__mockSession = val
}
