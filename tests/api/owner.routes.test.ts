import {beforeEach, describe, expect, it, vi} from 'vitest'

const h = vi.hoisted(() => ({owner: true, prisma: {} as any}))
vi.mock('@/lib/guard', () => ({
  requireOwner: async () => {
    if (!h.owner) throw new Response('Forbidden', {status: 403})
    return {user: {id: 'me', isOwner: true}}
  },
}))
vi.mock('@/lib/db', () => ({
  get prisma() {
    return h.prisma
  },
}))

import * as bandRoute from '@/app/api/owner/bands/[id]/route'
import * as userRoute from '@/app/api/owner/users/[id]/route'

const req = (method: string, body?: unknown) =>
  new Request('http://t/x', {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

describe('owner routes', () => {
  beforeEach(() => {
    h.owner = true
    h.prisma = {
      band: {
        findUnique: vi.fn(async () => ({id: 'b1', name: 'The Reeds'})),
        delete: vi.fn(async () => ({})),
        update: vi.fn(async ({data}: any) => ({id: 'b1', ...data})),
      },
      user: {
        findUnique: vi.fn(async ({where}: any) =>
          where.id === 'boss'
            ? {id: 'boss', isOwner: true}
            : {id: where.id, isOwner: false},
        ),
        findFirst: vi.fn(async () => null),
        delete: vi.fn(async () => ({})),
        update: vi.fn(async ({data}: any) => data),
      },
    }
  })

  it('deletes a band only with its exact name', async () => {
    const p = {params: {id: 'b1'}}
    expect(
      (await bandRoute.DELETE(req('DELETE', {confirm: 'the reeds'}), p)).status,
    ).toBe(400)
    expect(h.prisma.band.delete).not.toHaveBeenCalled()
    expect(
      (await bandRoute.DELETE(req('DELETE', {confirm: 'The Reeds'}), p)).status,
    ).toBe(204)
    expect(h.prisma.band.delete).toHaveBeenCalledWith({where: {id: 'b1'}})
  })

  it('makes a band free, or paid until a date', async () => {
    const p = {params: {id: 'b1'}}
    await bandRoute.PATCH(req('PATCH', {paidUntil: null}), p)
    expect(h.prisma.band.update.mock.calls[0][0].data).toEqual({
      paidUntil: null,
    })
    await bandRoute.PATCH(req('PATCH', {paidUntil: '2027-06-30'}), p)
    expect(h.prisma.band.update.mock.calls[1][0].data.paidUntil).toEqual(
      new Date('2027-06-30T23:59:59Z'),
    )
  })

  it('never deletes the owner, or the one asking', async () => {
    expect(
      (await userRoute.DELETE(req('DELETE'), {params: {id: 'boss'}})).status,
    ).toBe(400)
    expect(
      (await userRoute.DELETE(req('DELETE'), {params: {id: 'me'}})).status,
    ).toBe(400)
    expect(h.prisma.user.delete).not.toHaveBeenCalled()
    expect(
      (await userRoute.DELETE(req('DELETE'), {params: {id: 'u2'}})).status,
    ).toBe(204)
  })

  it('won’t give someone an email another person uses', async () => {
    h.prisma.user.findFirst.mockResolvedValue({id: 'other'})
    const res = await userRoute.PATCH(req('PATCH', {email: 'taken@x.com'}), {
      params: {id: 'u2'},
    })
    expect(res.status).toBe(409)
  })

  it('is for the owner alone', async () => {
    h.owner = false
    expect(
      (
        await bandRoute.DELETE(req('DELETE', {confirm: 'The Reeds'}), {
          params: {id: 'b1'},
        })
      ).status,
    ).toBe(403)
    expect(
      (await userRoute.DELETE(req('DELETE'), {params: {id: 'u2'}})).status,
    ).toBe(403)
    expect(h.prisma.band.delete).not.toHaveBeenCalled()
  })
})
