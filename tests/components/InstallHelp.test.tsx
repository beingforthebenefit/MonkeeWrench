import {act, render} from '@testing-library/react'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

vi.mock('@khmyznikov/pwa-install', () => ({}))

import InstallHelp, {needsInstallHelp} from '@/components/pwa/InstallHelp'
import {showInstallHelp, watchInstallOffer} from '@/components/pwa/pwa'

const shown = vi.fn()
beforeAll(() => {
  window.matchMedia = (() => ({matches: false})) as never
  customElements.define(
    'pwa-install',
    class extends HTMLElement {
      showDialog(forced?: boolean) {
        shown(forced)
      }
    },
  )
})

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'

function device(ua: string, standalone = false) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua)
  Object.defineProperty(navigator, 'standalone', {
    value: standalone,
    configurable: true,
  })
}

const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/129 Mobile'

// Mount, and let the library's (mocked) import land
async function mount(tourDone = true) {
  const r = render(<InstallHelp tourDone={tourDone} />)
  await act(async () => {
    await vi.dynamicImportSettled()
  })
  return r
}

beforeEach(() => {
  vi.useFakeTimers({shouldAdvanceTime: true})
  shown.mockClear()
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('InstallHelp on an iPhone', () => {
  it('is for a phone or tablet outside the installed app', () => {
    device('Mozilla/5.0 (Windows NT 10.0) Chrome/129')
    expect(needsInstallHelp()).toBe(false)
    device(ANDROID)
    expect(needsInstallHelp()).toBe(true)
    device(IPHONE, true)
    expect(needsInstallHelp()).toBe(false)
    device(IPHONE)
    expect(needsInstallHelp()).toBe(true)
  })

  it('loads nothing on other devices', async () => {
    device('Mozilla/5.0 (Windows NT 10.0) Chrome/129')
    const {container} = await mount()
    expect(container.querySelector('pwa-install')).toBeNull()
  })

  it('offers itself on a visit, then not again for a week', async () => {
    device(IPHONE)
    const first = await mount()
    expect(first.container.querySelector('pwa-install')).not.toBeNull()
    expect(shown).not.toHaveBeenCalled()
    await act(() => vi.advanceTimersByTimeAsync(4000))
    expect(shown).toHaveBeenCalledWith(true)
    first.unmount()

    shown.mockClear()
    const again = await mount()
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(shown).not.toHaveBeenCalled()
    again.unmount()
  })

  it('stops offering after three times', async () => {
    device(IPHONE)
    localStorage.setItem('ms:install-asked', JSON.stringify({n: 3, at: 0}))
    await mount()
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(shown).not.toHaveBeenCalled()
  })

  it('waits for the tour, then offers when it ends', async () => {
    device(IPHONE)
    sessionStorage.setItem('ms:tour-step', '3')
    await mount()
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(shown).not.toHaveBeenCalled()
    act(() => {
      window.dispatchEvent(new Event('ms:tour-done'))
    })
    expect(shown).toHaveBeenCalledTimes(1)
  })

  it('does not interrupt a first visit (the tour starts instead)', async () => {
    device(IPHONE)
    await mount(false)
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(shown).not.toHaveBeenCalled()
  })

  it('"Show me how" opens it any time', async () => {
    device(IPHONE)
    localStorage.setItem(
      'ms:install-asked',
      JSON.stringify({n: 3, at: Date.now()}),
    )
    await mount()
    act(() => showInstallHelp())
    expect(shown).toHaveBeenCalledWith(true)
  })
})

describe('InstallHelp on Android', () => {
  // Chrome's install offer, as pwa.ts catches it
  function chromeOffers(outcome = 'accepted') {
    const prompt = vi.fn(async () => {})
    const e = Object.assign(new Event('beforeinstallprompt'), {
      prompt,
      userChoice: Promise.resolve({outcome}),
    })
    act(() => {
      window.dispatchEvent(e)
    })
    return prompt
  }
  beforeAll(() => watchInstallOffer())

  it('offers Chrome’s install dialog after a while, and closes once installed', async () => {
    device(ANDROID)
    const prompt = chromeOffers()
    const r = await mount()
    expect(r.queryByRole('dialog')).toBeNull()
    await act(() => vi.advanceTimersByTimeAsync(4000))
    expect(r.getByRole('dialog')).toHaveTextContent(
      'Add the app to your home screen',
    )
    await act(async () => {
      r.getByRole('button', {name: 'Install'}).click()
    })
    expect(prompt).toHaveBeenCalled()
    expect(r.queryByRole('dialog')).toBeNull()
  })

  it('without Chrome’s offer (another browser), shows the steps', async () => {
    device(ANDROID)
    // A previous install used up the offer
    const r = await mount()
    act(() => showInstallHelp())
    expect(r.getByRole('dialog')).toHaveTextContent('Install app')
    expect(r.queryByRole('button', {name: 'Install'})).toBeNull()
    act(() => r.getByRole('button', {name: 'Close'}).click())
    expect(r.queryByRole('dialog')).toBeNull()
  })

  it('“Not now” puts it away, and it isn’t offered again for a week', async () => {
    device(ANDROID)
    chromeOffers()
    const r = await mount()
    await act(() => vi.advanceTimersByTimeAsync(4000))
    act(() => r.getByRole('button', {name: 'Not now'}).click())
    expect(r.queryByRole('dialog')).toBeNull()
    r.unmount()
    const again = await mount()
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(again.queryByRole('dialog')).toBeNull()
  })
})
