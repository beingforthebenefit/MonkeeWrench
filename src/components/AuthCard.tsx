import {ReactNode} from 'react'
import {PRODUCT, iconUrl} from '@/lib/band'

/** The one-column card the sign-in, start and password pages share. */
export default function AuthCard({
  title,
  intro,
  children,
}: {
  title: string
  intro?: ReactNode
  children: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconUrl(null)}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-xl"
          />
          <p className="text-[14px] font-extrabold uppercase tracking-[0.2em] text-muted">
            {PRODUCT}
          </p>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold">{title}</h1>
        {intro && <p className="mt-1 text-muted">{intro}</p>}
        {children}
      </div>
    </main>
  )
}
