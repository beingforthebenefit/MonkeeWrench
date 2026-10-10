/*
 * The public demo (bandstand.info) is a static capture of the app: there is
 * no server behind it. Loaded first thing in <head> on every captured page
 * (only in a NEXT_PUBLIC_DEMO build), this answers every change the app
 * tries to save with a refusal and says so, and keeps the live-update stream
 * from retrying forever. Reading still works: the pages, PDFs and calendar
 * files that were captured are plain files.
 */
;(function () {
  var MESSAGE = 'This is a demo — nothing you change is saved.'

  // A static host may answer /songs by redirecting to /songs/ (the folder);
  // the app's routes have no trailing slash, so put it back before it starts
  if (location.pathname.length > 1 && /\/$/.test(location.pathname))
    history.replaceState(
      history.state,
      '',
      location.pathname.replace(/\/+$/, '') + location.search + location.hash,
    )
  var realFetch = window.fetch.bind(window)

  function path(input) {
    try {
      var url = new URL(
        typeof input === 'string' ? input : input.url,
        location.href,
      )
      return url.origin === location.origin ? url.pathname : null
    } catch {
      return null
    }
  }

  // Bookkeeping the app does on its own, not something the visitor asked to
  // save: answer it quietly
  function quiet(p, body) {
    if (/^\/api\/auth\/_log/.test(p)) return true
    return (
      p === '/api/account/settings' &&
      typeof body === 'string' &&
      body.indexOf('"tourDone"') !== -1
    )
  }

  // PDFs and calendar files were saved with their extension (so they open
  // as what they are); the app links to them without one
  function captured(p) {
    if (p === '/api/export') return '/api/export.json'
    return /^\/api\/.+\/(pdf|ics)$/.test(p)
      ? p + '.' + p.split('/').pop()
      : null
  }

  document.addEventListener(
    'click',
    function (e) {
      var a = e.target.closest && e.target.closest('a[href]')
      var p = a && path(a.href)
      var file = p && captured(p)
      if (file) {
        e.preventDefault()
        location.href = file
      }
    },
    true,
  )

  var toast, timer
  function say() {
    if (!toast) {
      toast = document.createElement('div')
      toast.setAttribute('role', 'status')
      toast.style.cssText =
        'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));' +
        'transform:translateX(-50%);z-index:2147483647;max-width:calc(100vw - 32px);' +
        'padding:10px 16px;border-radius:10px;background:#f2b134;color:#111;' +
        'font:600 14px/1.35 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.4);' +
        'transition:opacity .2s;text-align:center'
      document.body.appendChild(toast)
    }
    toast.textContent = MESSAGE
    toast.style.opacity = '1'
    clearTimeout(timer)
    timer = setTimeout(function () {
      toast.style.opacity = '0'
    }, 3200)
  }

  window.fetch = function (input, init) {
    var p = path(input)
    var method = (
      (init && init.method) ||
      (typeof input === 'object' && input.method) ||
      'GET'
    ).toUpperCase()
    if (
      p &&
      p.indexOf('/api/') === 0 &&
      method !== 'GET' &&
      method !== 'HEAD'
    ) {
      var body = init && init.body
      if (quiet(p, body))
        return Promise.resolve(
          new Response('{}', {headers: {'Content-Type': 'application/json'}}),
        )
      say()
      return Promise.resolve(
        new Response(JSON.stringify({error: MESSAGE, message: MESSAGE}), {
          status: 403,
          headers: {'Content-Type': 'application/json'},
        }),
      )
    }
    var file = p && captured(p)
    if (file) return realFetch(file, init)
    return realFetch(input, init)
  }

  // Live updates (proposals) have nothing to listen to
  window.EventSource = function () {
    this.readyState = 2
    this.close = function () {}
    this.addEventListener = function () {}
    this.removeEventListener = function () {}
  }
})()
