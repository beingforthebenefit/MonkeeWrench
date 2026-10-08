// Vitest + Testing Library setup
import '@testing-library/jest-dom/vitest'

// next-auth/react parses NEXTAUTH_URL when it loads and throws on "", which
// is what the dev Docker image sets (ENV from an unset build arg)
if (!process.env.NEXTAUTH_URL)
  process.env.NEXTAUTH_URL = 'http://localhost:3000'

// JSDOM has no matchMedia (theme and perform mode read it); nothing matches
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

// Basic EventSource stub to avoid crashes in components using SSE
class MockEventSource {
  url: string
  onmessage: ((this: EventSource, ev: MessageEvent) => any) | null = null
  onopen: ((this: EventSource, ev: Event) => any) | null = null
  onerror: ((this: EventSource, ev: Event) => any) | null = null
  constructor(url: string) {
    this.url = url
    // no-op
  }
  close() {}
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
  dispatchEvent = vi.fn()
}
globalThis.EventSource = MockEventSource as unknown as typeof EventSource

// Default fetch mock (tests override per-case)
if (typeof globalThis.fetch === 'undefined') {
  globalThis.fetch = vi.fn(
    async () =>
      new Response(JSON.stringify({}), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }),
  )
}

// next-auth/react mock that preserves SessionProvider but lets tests control useSession
// Tests can set (globalThis as any).__mockSession = {data, status}
;(globalThis as any).__mockSession = {data: null, status: 'unauthenticated'}
vi.mock('next-auth/react', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    useSession: () => (globalThis as any).__mockSession,
    SessionProvider: actual.SessionProvider,
    signIn: vi.fn(),
    signOut: vi.fn(),
    // The login page asks which providers are enabled; tests set
    // (globalThis as any).__mockProviders to change the answer
    getProviders: vi.fn(
      async () =>
        (globalThis as any).__mockProviders ?? {
          credentials: {
            id: 'credentials',
            name: 'Password',
            type: 'credentials',
          },
        },
    ),
  }
})
