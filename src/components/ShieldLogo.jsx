/**
 * ShieldLogo
 *
 * The SecureShield shield-with-tick mark. It takes its colour from the
 * surrounding text colour (currentColor), so set `color` on the parent in CSS.
 *
 * Props:
 *   size      - width/height in px (default 24)
 *   className - optional extra class
 */
export default function ShieldLogo({ size = 24, className = "" }) {
  return (
    <svg
      className={className || undefined}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2L4 5v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path
        d="M9 12l2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
