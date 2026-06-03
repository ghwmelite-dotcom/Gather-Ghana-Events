import { useState } from 'react'

/**
 * Lazy, layout-stable image.
 * - Reserves space via aspect-ratio (prevents CLS).
 * - Shows a shimmer until loaded, fades in on load.
 * - Falls back to an on-brand gradient if the remote image fails.
 *
 * @param {string} src
 * @param {string} alt        Required for meaningful images ('' for decorative).
 * @param {string} ratio      CSS aspect-ratio, e.g. '4 / 5'. Omit to fill parent.
 * @param {string} fallback   Tailwind gradient classes used on error.
 * @param {boolean} eager     Skip lazy-loading (use for LCP/hero only).
 */
export default function Img({
  src,
  alt = '',
  ratio,
  fallback = 'from-plum-soft/40 to-plum-deep/50',
  eager = false,
  className = '',
  imgClassName = '',
}) {
  const [loaded, setLoaded] = useState(false)
  const [errored, setErrored] = useState(false)

  return (
    <div
      className={`relative overflow-hidden bg-cream-deep ${className}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {!loaded && !errored && (
        <div className="absolute inset-0 shimmer" aria-hidden="true" />
      )}

      {errored ? (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${fallback}`}
          role={alt ? 'img' : undefined}
          aria-label={alt || undefined}
        />
      ) : (
        <img
          src={src}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          fetchpriority={eager ? 'high' : 'auto'}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`h-full w-full object-cover transition-opacity duration-700 ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${imgClassName}`}
        />
      )}
    </div>
  )
}
