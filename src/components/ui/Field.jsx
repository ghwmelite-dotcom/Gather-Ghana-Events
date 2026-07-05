import { useId } from 'react'

const inputBase =
  'w-full rounded-xl border bg-white px-4 transition-colors ' +
  'focus:outline-none focus-visible:outline-none placeholder:text-ink/35'

/**
 * Accessible form field: visible label, optional helper, inline error.
 * Wires aria-invalid / aria-describedby / aria-required automatically.
 * Pass `as="textarea"` for multi-line.
 */
export default function Field({
  id: idProp,
  label,
  name,
  type = 'text',
  as = 'input',
  required = false,
  error,
  helper,
  value,
  onChange,
  onBlur,
  tone = 'light',
  className = '',
  ...rest
}) {
  const autoId = useId()
  const id = idProp || autoId
  const errId = `${id}-err`
  const helpId = `${id}-help`
  const describedBy = [error ? errId : null, helper ? helpId : null].filter(Boolean).join(' ')
  const borderState = error ? 'border-terracotta' : 'border-plum/20 focus:border-plum'

  const Tag = as
  const sizing = as === 'textarea' ? 'py-3 resize-none' : 'h-12'

  return (
    <div className={className}>
      <label htmlFor={id} className={`block text-sm mb-2 ${tone === 'dark' ? 'text-cream/70' : 'text-ink/60'}`}>
        {label}
        {required && <span className="text-terracotta ml-0.5" aria-hidden="true">*</span>}
      </label>
      <Tag
        id={id}
        name={name}
        type={as === 'input' ? type : undefined}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        aria-required={required || undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`${inputBase} ${sizing} ${borderState}`}
        {...rest}
      />
      {helper && !error && (
        <p id={helpId} className={`mt-1.5 text-xs ${tone === 'dark' ? 'text-cream/50' : 'text-ink/45'}`}>{helper}</p>
      )}
      {error && (
        <p id={errId} role="alert" className="mt-1.5 text-xs text-terracotta">{error}</p>
      )}
    </div>
  )
}
