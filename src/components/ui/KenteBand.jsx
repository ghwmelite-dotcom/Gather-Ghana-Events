// A slim Kente-inspired woven stripe. Two layers: an asymmetric warp sequence
// (the colours) and a faint weft overlay (the horizontal threads). Used as a
// refined accent/divider — never as a loud full-cloth background.

const WARP =
  'repeating-linear-gradient(90deg,' +
  '#C9A24B 0 12px,' + // gold
  '#2B1B2E 12px 18px,' + // plum
  '#B5654A 18px 26px,' + // terracotta
  '#F5ECD7 26px 32px,' + // champagne pale
  '#1F6B52 32px 44px,' + // kente green
  '#2B1B2E 44px 50px,' + // plum
  '#E4C97E 50px 58px,' + // light gold
  '#B5654A 58px 64px)' // terracotta
const WEFT =
  'repeating-linear-gradient(0deg, rgba(0,0,0,0.14) 0 1px, transparent 1px 4px)'

/**
 * @param {string} className  Use to set height, e.g. "h-1.5" (default) or "h-2".
 */
export default function KenteBand({ className = 'h-1.5' }) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`w-full ${className}`}
      style={{ backgroundImage: `${WEFT}, ${WARP}` }}
    />
  )
}
