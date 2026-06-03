import { Link } from 'react-router-dom'
import { Spinner } from '../../lib/icons.jsx'

const base =
  'inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-wide ' +
  'transition-all duration-200 ease-out-expo cursor-pointer ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne ' +
  'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]'

const variants = {
  primary: 'bg-plum text-cream hover:bg-plum-soft shadow-sm hover:shadow-md',
  gold: 'bg-champagne text-plum-deep hover:bg-champagne-light shadow-sm hover:shadow-glow',
  outline: 'border border-plum/25 text-plum hover:border-plum/60 hover:bg-plum/5',
  ghostLight: 'border border-cream/30 text-cream hover:bg-cream/10',
}

const sizes = {
  sm: 'px-5 py-2.5 text-sm',
  md: 'px-7 py-3.5 text-[15px]',
  lg: 'px-9 py-4 text-base',
}

/**
 * Polymorphic button. Renders <Link> (to), <a> (href), or <button>.
 * Shows a spinner and blocks interaction while `loading`.
 */
export default function Button({
  to,
  href,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...rest
}) {
  const cls = `${base} ${variants[variant]} ${sizes[size]} ${className}`
  const content = (
    <>
      {loading && <Spinner size={18} />}
      {children}
    </>
  )

  if (to && !disabled && !loading) {
    return (
      <Link to={to} className={cls} {...rest}>
        {content}
      </Link>
    )
  }
  if (href && !disabled && !loading) {
    return (
      <a href={href} className={cls} {...rest}>
        {content}
      </a>
    )
  }
  return (
    <button
      className={cls}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  )
}
