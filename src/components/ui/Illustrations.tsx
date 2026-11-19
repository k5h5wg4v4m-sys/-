/** Иллюстрации пустых состояний. Цвета — только токены темы. */
export function EmptyFavoritesIllustration() {
  return (
    <svg viewBox="0 0 160 140" className="mb-5 h-36 w-40" aria-hidden>
      <circle cx="80" cy="70" r="62" fill="var(--primary-soft)" />
      <circle cx="80" cy="70" r="44" fill="var(--bg)" stroke="var(--border)" strokeWidth="2" />
      <path
        d="M80 92s-22-12.6-22-28.4C58 55.5 64.2 50 71 50c4.4 0 7.3 2.3 9 5 1.7-2.7 4.6-5 9-5 6.8 0 13 5.5 13 13.6C102 79.4 80 92 80 92Z"
        fill="var(--primary)"
      />
      <circle cx="128" cy="30" r="6" fill="var(--primary)" opacity=".35" />
      <circle cx="30" cy="104" r="4" fill="var(--primary)" opacity=".5" />
      <path d="M134 98l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="var(--primary)" opacity=".6" />
      <path d="M26 30l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="var(--primary)" opacity=".45" />
    </svg>
  );
}

export function EmptyBoxIllustration() {
  return (
    <svg viewBox="0 0 160 140" className="mb-5 h-36 w-40" aria-hidden>
      <circle cx="80" cy="70" r="62" fill="var(--primary-soft)" />
      <path d="M44 58l36-18 36 18v40l-36 18-36-18z" fill="var(--bg)" stroke="var(--border)" strokeWidth="2" />
      <path d="M44 58l36 18 36-18M80 76v40" fill="none" stroke="var(--border)" strokeWidth="2" />
      <path d="M62 49l36 18" stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" />
      <circle cx="126" cy="34" r="6" fill="var(--primary)" opacity=".35" />
      <path d="M30 96l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="var(--primary)" opacity=".5" />
    </svg>
  );
}
