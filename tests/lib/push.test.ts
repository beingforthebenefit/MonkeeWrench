import {describe, it, expect} from 'vitest'
import {categoryOf, describe as describeChanges, linkFor} from '@/lib/push'

const band = {id: 'b1', name: "Satchmo's Ghost"}
const act = (
  o: Partial<Parameters<typeof describeChanges>[0][number]> = {},
) => ({
  action: 'chart.save',
  targetType: 'song',
  targetId: 's1',
  summary: 'edited the chart for Sway',
  user: {name: 'Alan Macomber', displayName: 'Alan'},
  ...o,
})

describe('push notifications', () => {
  it('sorts changes into the kinds people choose', () => {
    expect(categoryOf('chart.save')).toBe('charts')
    expect(categoryOf('song.create')).toBe('charts')
    expect(categoryOf('setlist.update')).toBe('setlists')
    expect(categoryOf('rehearsal.create')).toBe('rehearsals')
    expect(categoryOf('proposal.create')).toBe('proposals')
    expect(categoryOf('availability.update')).toBeNull()
    expect(categoryOf('member.add')).toBeNull()
  })

  it('links through the band switch, so it opens in the right band', () => {
    expect(linkFor({targetType: 'song', targetId: 's1'}, 'b1')).toBe(
      '/bands/switch?to=b1&next=%2Fsongs%2Fs1',
    )
    expect(linkFor({targetType: 'rehearsal', targetId: 'r1'}, 'b1')).toContain(
      'next=%2Frehearsals',
    )
  })

  it('says one change plainly', () => {
    const m = describeChanges([act()], band)
    expect(m.title).toBe("Satchmo's Ghost")
    expect(m.body).toBe('Alan edited the chart for Sway')
    expect(m.url).toContain('%2Fsongs%2Fs1')
  })

  it('bundles a burst into one', () => {
    const m = describeChanges(
      [
        act(),
        act({summary: 'edited the chart for Sway'}),
        act({
          targetId: 's2',
          summary: 'edited the chart for Lowdown',
          user: {name: 'Rod Mills', displayName: 'Rod'},
        }),
      ],
      band,
    )
    expect(m.body).toBe(
      'Alan and Rod: edited the chart for Sway; edited the chart for Lowdown',
    )
    expect(m.url).toContain('%2Factivity')
    // Edits to one chart still open that chart
    expect(describeChanges([act(), act()], band).url).toContain('%2Fsongs%2Fs1')
  })
})
