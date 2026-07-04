import { Lock } from '../lib/icons.jsx'

/** Slim notice shown to organizer viewers who cannot make changes. */
export default function ReadOnlyBanner() {
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-plum text-cream text-sm px-4 py-2"
    >
      <Lock size={14} className="text-champagne-light" />
      You have read-only access — changes are disabled.
    </div>
  )
}
