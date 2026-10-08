import React from 'react'
import {describe, it, expect} from 'vitest'
import {render} from '@testing-library/react'
import Avatar from '@/components/Avatar'

describe('Avatar', () => {
  it('shows the photo when there is one', () => {
    const {container} = render(<Avatar name="Ken" src="/api/avatars/u1?v=1" />)
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/api/avatars/u1?v=1',
    )
  })

  it('falls back to the initial', () => {
    const {container} = render(<Avatar name="ken" src={null} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toBe('k')
  })
})
