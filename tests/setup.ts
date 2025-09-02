// Vitest + Testing Library setup
import '@testing-library/jest-dom/vitest'

// Some UI libs (MUI) expect matchMedia in JSDOM
if (typeof window !== 'undefined' && !('matchMedia' in window)) {
  // @ts-expect-error - define for tests
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(globalThis as any).__mockSession = {data: null, status: 'unauthenticated'}
vi.mock('next-auth/react', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    useSession: () => (globalThis as any).__mockSession,
    SessionProvider: actual.SessionProvider,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }
})
