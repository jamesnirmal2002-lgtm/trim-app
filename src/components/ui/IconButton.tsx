import { ArrowRight } from 'lucide-react'

type IconButtonProps = {
  label: string
  onClick: () => void
}

/** Brand forward action used only for advancing through the setup flow. */
export function IconButton({ label, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-center rounded-xl bg-clay px-5 py-3.5 text-sm font-semibold text-surface transition hover:bg-clay/90 focus:outline-none focus:ring-2 focus:ring-clay focus:ring-offset-2"
    >
      {label}
      <ArrowRight
        className="ml-2 -mr-1 opacity-75 transition-transform duration-200 group-hover:translate-x-1 group-focus-visible:translate-x-1"
        size={17}
        strokeWidth={2.25}
        aria-hidden="true"
      />
    </button>
  )
}