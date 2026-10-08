import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AvatarEditor from '@/components/AvatarEditor'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({useRouter: () => ({refresh})}))
const resized = new Blob(['jpeg'], {type: 'image/jpeg'})
vi.mock('@/lib/resize-image', () => ({squareJpeg: vi.fn(async () => resized)}))

describe('AvatarEditor', () => {
  beforeEach(() => {
    refresh.mockReset()
    globalThis.fetch = vi.fn(
      async () => new Response('{}', {status: 200}),
    ) as any
  })

  it('uploads the resized photo for that member', async () => {
    const {container} = render(
      <AvatarEditor userId="u1" name="Ken" src={null} />,
    )
    const input = container.querySelector(
      'input[type=file]',
    ) as HTMLInputElement
    await userEvent.upload(
      input,
      new File(['x'], 'me.jpg', {type: 'image/jpeg'}),
    )
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/avatars/u1', {
      method: 'PUT',
      headers: {'Content-Type': 'image/jpeg'},
      body: resized,
    })
    expect(refresh).toHaveBeenCalled()
  })

  it('removes the photo after confirming', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<AvatarEditor userId="u1" name="Ken" src="/api/avatars/u1?v=1" />)
    await userEvent.click(screen.getByRole('button', {name: 'Remove'}))
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/avatars/u1', {
      method: 'DELETE',
    })
  })

  it('compact: just the picture, labelled for the member', () => {
    render(<AvatarEditor compact userId="u2" name="Ed" src={null} />)
    expect(
      screen.getByRole('button', {name: 'Add a photo for Ed'}),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Remove'})).toBeNull()
  })
})
