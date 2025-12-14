export function GitRadarLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* GitHub-style contribution grid with signal wave pattern */}
      {/* Row 1 - top */}
      <rect x="2" y="2" width="5" height="5" rx="1" fill="#0e4429" />
      <rect x="9" y="2" width="5" height="5" rx="1" fill="#0e4429" />
      <rect x="16" y="2" width="5" height="5" rx="1" fill="#26a641" />
      <rect x="23" y="2" width="5" height="5" rx="1" fill="#0e4429" />

      {/* Row 2 */}
      <rect x="2" y="9" width="5" height="5" rx="1" fill="#0e4429" />
      <rect x="9" y="9" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="16" y="9" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="23" y="9" width="5" height="5" rx="1" fill="#26a641" />

      {/* Row 3 - middle (signal peak) */}
      <rect x="2" y="16" width="5" height="5" rx="1" fill="#26a641" />
      <rect x="9" y="16" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="16" y="16" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="23" y="16" width="5" height="5" rx="1" fill="#39d353" />

      {/* Row 4 - bottom */}
      <rect x="2" y="23" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="9" y="23" width="5" height="5" rx="1" fill="#26a641" />
      <rect x="16" y="23" width="5" height="5" rx="1" fill="#0e4429" />
      <rect x="23" y="23" width="5" height="5" rx="1" fill="#0e4429" />
    </svg>
  );
}

export function GitRadarLogoWithSignal({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* GitHub-style contribution grid - 4x4 */}
      {/* Row 1 */}
      <rect x="2" y="2" width="5" height="5" rx="1" fill="#0e4429" />
      <rect x="9" y="2" width="5" height="5" rx="1" fill="#0e4429" />
      <rect x="16" y="2" width="5" height="5" rx="1" fill="#26a641" />
      <rect x="23" y="2" width="5" height="5" rx="1" fill="#0e4429" />

      {/* Row 2 */}
      <rect x="2" y="9" width="5" height="5" rx="1" fill="#0e4429" />
      <rect x="9" y="9" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="16" y="9" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="23" y="9" width="5" height="5" rx="1" fill="#26a641" />

      {/* Row 3 */}
      <rect x="2" y="16" width="5" height="5" rx="1" fill="#26a641" />
      <rect x="9" y="16" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="16" y="16" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="23" y="16" width="5" height="5" rx="1" fill="#39d353" />

      {/* Row 4 */}
      <rect x="2" y="23" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="9" y="23" width="5" height="5" rx="1" fill="#26a641" />
      <rect x="16" y="23" width="5" height="5" rx="1" fill="#0e4429" />
      <rect x="23" y="23" width="5" height="5" rx="1" fill="#0e4429" />

      {/* Signal wave lines emanating from the grid */}
      <path
        d="M31 16 C33 16 33 10 35 10 C37 10 37 22 39 22"
        stroke="url(#signalGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M31 16 C32 16 32 12 34 12 C36 12 36 20 38 20"
        stroke="url(#signalGradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.5"
      />

      <defs>
        <linearGradient id="signalGradient" x1="31" y1="16" x2="39" y2="16">
          <stop offset="0%" stopColor="#39d353" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function GitRadarLogoAlt({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Grid of squares forming a rising signal pattern */}
      {/* Column 1 - lowest */}
      <rect x="2" y="23" width="5" height="5" rx="1" fill="#39d353" />

      {/* Column 2 */}
      <rect x="9" y="18" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="9" y="25" width="5" height="5" rx="1" fill="#26a641" />

      {/* Column 3 */}
      <rect x="16" y="11" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="16" y="18" width="5" height="5" rx="1" fill="#26a641" />
      <rect x="16" y="25" width="5" height="5" rx="1" fill="#0e4429" />

      {/* Column 4 - highest */}
      <rect x="23" y="4" width="5" height="5" rx="1" fill="#39d353" />
      <rect x="23" y="11" width="5" height="5" rx="1" fill="#26a641" />
      <rect x="23" y="18" width="5" height="5" rx="1" fill="#0e4429" />
      <rect x="23" y="25" width="5" height="5" rx="1" fill="#0e4429" />
    </svg>
  );
}

export function GitRadarLogoWave({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Wave pattern using GitHub-style squares */}
      {/* Creates a signal wave going diagonally through a grid */}

      {/* Background dim squares */}
      <rect x="2" y="2" width="4" height="4" rx="0.8" fill="#0e4429" />
      <rect x="8" y="2" width="4" height="4" rx="0.8" fill="#0e4429" />
      <rect x="14" y="2" width="4" height="4" rx="0.8" fill="#0e4429" />
      <rect x="20" y="2" width="4" height="4" rx="0.8" fill="#26a641" />
      <rect x="26" y="2" width="4" height="4" rx="0.8" fill="#0e4429" />

      <rect x="2" y="8" width="4" height="4" rx="0.8" fill="#0e4429" />
      <rect x="8" y="8" width="4" height="4" rx="0.8" fill="#0e4429" />
      <rect x="14" y="8" width="4" height="4" rx="0.8" fill="#26a641" />
      <rect x="20" y="8" width="4" height="4" rx="0.8" fill="#39d353" />
      <rect x="26" y="8" width="4" height="4" rx="0.8" fill="#26a641" />

      <rect x="2" y="14" width="4" height="4" rx="0.8" fill="#0e4429" />
      <rect x="8" y="14" width="4" height="4" rx="0.8" fill="#26a641" />
      <rect x="14" y="14" width="4" height="4" rx="0.8" fill="#39d353" />
      <rect x="20" y="14" width="4" height="4" rx="0.8" fill="#26a641" />
      <rect x="26" y="14" width="4" height="4" rx="0.8" fill="#0e4429" />

      <rect x="2" y="20" width="4" height="4" rx="0.8" fill="#26a641" />
      <rect x="8" y="20" width="4" height="4" rx="0.8" fill="#39d353" />
      <rect x="14" y="20" width="4" height="4" rx="0.8" fill="#26a641" />
      <rect x="20" y="20" width="4" height="4" rx="0.8" fill="#0e4429" />
      <rect x="26" y="20" width="4" height="4" rx="0.8" fill="#0e4429" />

      <rect x="2" y="26" width="4" height="4" rx="0.8" fill="#39d353" />
      <rect x="8" y="26" width="4" height="4" rx="0.8" fill="#26a641" />
      <rect x="14" y="26" width="4" height="4" rx="0.8" fill="#0e4429" />
      <rect x="20" y="26" width="4" height="4" rx="0.8" fill="#0e4429" />
      <rect x="26" y="26" width="4" height="4" rx="0.8" fill="#0e4429" />
    </svg>
  );
}

export function GitRoastLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Flame/fire pattern using GitHub-style squares with red/orange/yellow colors */}
      {/* Creates a roasting flame effect */}

      {/* Row 1 - top flame tips */}
      <rect x="2" y="2" width="4" height="4" rx="0.8" fill="#451a03" />
      <rect x="8" y="2" width="4" height="4" rx="0.8" fill="#451a03" />
      <rect x="14" y="2" width="4" height="4" rx="0.8" fill="#f97316" />
      <rect x="20" y="2" width="4" height="4" rx="0.8" fill="#451a03" />
      <rect x="26" y="2" width="4" height="4" rx="0.8" fill="#451a03" />

      {/* Row 2 */}
      <rect x="2" y="8" width="4" height="4" rx="0.8" fill="#451a03" />
      <rect x="8" y="8" width="4" height="4" rx="0.8" fill="#f97316" />
      <rect x="14" y="8" width="4" height="4" rx="0.8" fill="#fbbf24" />
      <rect x="20" y="8" width="4" height="4" rx="0.8" fill="#f97316" />
      <rect x="26" y="8" width="4" height="4" rx="0.8" fill="#451a03" />

      {/* Row 3 - middle intense */}
      <rect x="2" y="14" width="4" height="4" rx="0.8" fill="#ea580c" />
      <rect x="8" y="14" width="4" height="4" rx="0.8" fill="#fbbf24" />
      <rect x="14" y="14" width="4" height="4" rx="0.8" fill="#fef08a" />
      <rect x="20" y="14" width="4" height="4" rx="0.8" fill="#fbbf24" />
      <rect x="26" y="14" width="4" height="4" rx="0.8" fill="#ea580c" />

      {/* Row 4 */}
      <rect x="2" y="20" width="4" height="4" rx="0.8" fill="#dc2626" />
      <rect x="8" y="20" width="4" height="4" rx="0.8" fill="#f97316" />
      <rect x="14" y="20" width="4" height="4" rx="0.8" fill="#fbbf24" />
      <rect x="20" y="20" width="4" height="4" rx="0.8" fill="#f97316" />
      <rect x="26" y="20" width="4" height="4" rx="0.8" fill="#dc2626" />

      {/* Row 5 - base of flame */}
      <rect x="2" y="26" width="4" height="4" rx="0.8" fill="#b91c1c" />
      <rect x="8" y="26" width="4" height="4" rx="0.8" fill="#dc2626" />
      <rect x="14" y="26" width="4" height="4" rx="0.8" fill="#ea580c" />
      <rect x="20" y="26" width="4" height="4" rx="0.8" fill="#dc2626" />
      <rect x="26" y="26" width="4" height="4" rx="0.8" fill="#b91c1c" />
    </svg>
  );
}
