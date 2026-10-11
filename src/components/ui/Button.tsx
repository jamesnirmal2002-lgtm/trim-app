type ButtonProps = {
  label: string
  onClick: () => void
  variant: 'primary' | 'secondary'
}

/** Reusable action button. App.tsx supplies the text, action, and visual treatment. */
export function Button({ label, onClick, variant }: ButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-clay text-surface hover:bg-clay/90 focus:ring-clay'
      : 'border border-line bg-surface text-ink hover:bg-cream focus:ring-ink'

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl px-5 py-3.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${styles}`}
    >
      {label}
    </button>
  )
}