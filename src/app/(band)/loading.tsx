/**
 * While a page that isn't kept yet comes from the server: the tab is
 * already highlighted and this shows where the page will be. It fades in
 * only after a moment, so a quick load doesn't flash.
 */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      className="loading-in mx-auto w-full max-w-3xl px-4 pt-5"
    >
      <div className="h-9 w-44 animate-pulse rounded-lg bg-panel" />
      <div className="mt-3 h-5 w-64 animate-pulse rounded bg-panel" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-panel" />
        ))}
      </div>
    </main>
  )
}
