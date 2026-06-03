// Adinkra symbols — Akan visual ideograms, each carrying a proverb or value.
// Drawn as clean, stylized line-symbols on a 64px grid so they sit naturally
// beside the brand's icon set. Decorative by default (aria-hidden); meanings
// are surfaced as visible text wherever they're used.

function Glyph({ children, size = 40, className = '', ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

// Akoma — "the heart": patience, tolerance, presence.
export const Akoma = (p) => (
  <Glyph {...p}>
    <path d="M32 23c-4-8-16-8-19 1-3 8 8 17 19 27 11-10 22-19 19-27-3-9-15-9-19-1Z" />
  </Glyph>
)

// Duafe — "the wooden comb": beauty, care, craftsmanship, feminine virtue.
export const Duafe = (p) => (
  <Glyph {...p}>
    <path d="M27 13q5-6 10 0" />
    <rect x="13" y="18" width="38" height="8" rx="3" />
    <path d="M19 26v26M27 26v26M35 26v26M43 26v26" />
  </Glyph>
)

// Sankofa — "return and fetch it": honouring heritage and tradition.
export const Sankofa = (p) => (
  <Glyph {...p}>
    <path d="M32 24c-4-8-16-8-19 1-3 8 8 17 19 27 11-10 22-19 19-27-3-9-15-9-19-1Z" />
    <path d="M32 31c-3 0-5 2-5 5s2 5 5 5" />
    <path d="M29 37l-2 4 4 1" />
  </Glyph>
)

// Nkyinkyim — "twisting": adaptability, dynamism, devotion to service.
export const Nkyinkyim = (p) => (
  <Glyph {...p}>
    <path d="M16 14v12h20V14M36 26v12H16v12h32" />
  </Glyph>
)

// Nkonsonkonson — "chain links": unity, human bonds, community.
export const Nkonsonkonson = (p) => (
  <Glyph {...p}>
    <rect x="21" y="9" width="22" height="28" rx="11" />
    <rect x="21" y="27" width="22" height="28" rx="11" />
  </Glyph>
)

// Convenience collection for sections that present meanings.
export const adinkra = {
  akoma: { Symbol: Akoma, name: 'Akoma', meaning: 'The heart — patience, tolerance, and being fully present.' },
  duafe: { Symbol: Duafe, name: 'Duafe', meaning: 'The wooden comb — beauty, care, and craftsmanship.' },
  sankofa: { Symbol: Sankofa, name: 'Sankofa', meaning: 'Return and fetch it — honouring heritage and tradition.' },
  nkyinkyim: { Symbol: Nkyinkyim, name: 'Nkyinkyim', meaning: 'Twisting — adaptability and devotion to service.' },
  nkonsonkonson: { Symbol: Nkonsonkonson, name: 'Nkonsonkonson', meaning: 'Chain links — unity and the bonds between people.' },
}
