/** A band and guard results for route tests that mock @/lib/guard. */
export const BAND = {
  id: 'b1',
  slug: 'test-band',
  name: 'Test Band',
  appName: 'Bandstand',
  timezone: 'America/Los_Angeles',
  chatUrl: null,
  tributeTo: null,
  voteThreshold: 2,
  scheduling: true,
  iconAt: null,
  isAdmin: false,
}

export function ctx(
  user: Record<string, unknown>,
  opts: {isAdmin?: boolean; band?: Partial<typeof BAND>} = {},
) {
  const band = {...BAND, ...opts.band, isAdmin: Boolean(opts.isAdmin)}
  return {
    session: {user: {email: 'x@example.com'}},
    user: {
      isOwner: false,
      shareAvailability: true,
      blockOtherBands: true,
      ...user,
    },
    band,
    bands: [band],
    isAdmin: Boolean(opts.isAdmin),
  }
}
