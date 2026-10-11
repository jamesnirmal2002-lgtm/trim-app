type InputFieldProps = {
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  type: string
}

/** Controlled field: its value lives in App.tsx and changes are sent back via onChange. */
export function InputField({ label, placeholder, value, onChange, type }: InputFieldProps) {
  const inputId = label.toLowerCase().replace(/\s+/g, '-')

  return (
    <label htmlFor={inputId} className="block">
      <span className="mb-2 block text-sm font-semibold text-ink">{label}</span>
      <input
        id={inputId}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-12 w-full rounded-xl border border-line bg-surface px-4 py-3 text-ink outline-none transition placeholder:text-muted focus:border-clay focus:ring-2 focus:ring-clay/25"
      />
    </label>
  )
}