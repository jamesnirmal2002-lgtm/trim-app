import type { ReactNode } from 'react'

type CardProps = {
  title: string
  children: ReactNode
}

/** Shared content container used throughout the five-screen prototype. */
export function Card({ title, children }: CardProps) {
  return (
    <section className="rounded-3xl border border-line bg-surface p-5 shadow-[0_12px_40px_rgba(28,25,23,0.06)] sm:p-6 lg:p-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{title}</h1>
      <div className="mt-6">{children}</div>
    </section>
  )
}