import React from 'react'
import {describe, it, expect, vi, beforeEach} from 'vitest'
import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({replace, refresh: vi.fn()}),
  useSearchParams: () => new URLSearchParams('callbackUrl=%2Fsetlists'),
}))

describe('LoginPage', () => {
  beforeEach(() => replace.mockReset())

  it('signs in with email and password and returns to the page asked for', async () => {
    const mod: any = await import('next-auth/react')
    mod.signIn.mockResolvedValue({ok: true, error: null})
    const Page = (await import('@/app/login/page')).default
    render(<Page />)
    await userEvent.type(screen.getByLabelText('Email'), 'ken@example.com')
    await userEvent.type(
      screen.getByLabelText('Password'),
      'k7mq-x2vd-9rta-hp3e',
    )
    await userEvent.click(screen.getByRole('button', {name: 'Sign in'}))
    expect(mod.signIn).toHaveBeenCalledWith('credentials', {
      email: 'ken@example.com',
      password: 'k7mq-x2vd-9rta-hp3e',
      redirect: false,
    })
    expect(replace).toHaveBeenCalledWith('/setlists')
  })

  it('says so when the password is wrong', async () => {
    const mod: any = await import('next-auth/react')
    mod.signIn.mockResolvedValue({ok: false, error: 'CredentialsSignin'})
    const Page = (await import('@/app/login/page')).default
    render(<Page />)
    await userEvent.type(screen.getByLabelText('Email'), 'ken@example.com')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong')
    await userEvent.click(screen.getByRole('button', {name: 'Sign in'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('don’t match')
    expect(replace).not.toHaveBeenCalled()
  })
})
