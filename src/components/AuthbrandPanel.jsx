import ShieldLogo from "./ShieldLogo.jsx";
import "./AuthbrandPanel.css";

/**
 * AuthBrandPanel
 *
 * Left-hand side of the login / register screens: brand, headline, tagline,
 * a sample scan showing what the product actually does, and a short feature
 * list. Hidden on small screens (AuthLayout shows a compact logo instead).
 *
 * Props:
 *   headline - main heading text
 *   tagline  - one or two sentences under the heading
 *   features - array of short strings, one per bullet
 */

function CheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function AuthbrandPanel({ headline, tagline, features = [] }) {
  return (
    <aside className="brand-panel">
      <div className="brand-panel__inner">
        <div className="brand-panel__brand">
          <span className="brand-panel__logo">
            <ShieldLogo size={26} />
          </span>
          <span className="brand-panel__name">SecureShield</span>
        </div>

        <div className="brand-panel__copy">
          <h2 className="brand-panel__headline">{headline}</h2>
          <p className="brand-panel__tagline">{tagline}</p>
        </div>

        {/* Illustrative sample only: it is not a live result. */}
        <figure className="brand-panel__scan" aria-hidden="true">
          <figcaption className="brand-panel__scan-head">
            <span>Sample scan</span>
            <span className="brand-panel__verdict">High Risk 96%</span>
          </figcaption>
          <p className="brand-panel__scan-text">
            Your account has been{" "}
            <mark className="brand-panel__flag">suspended</mark>.{" "}
            <mark className="brand-panel__flag">Verify now</mark> at{" "}
            <mark className="brand-panel__flag">paypa1-secure.com/login</mark>{" "}
            or it will be closed within 24 hours.
          </p>
          <div className="brand-panel__scan-foot">
            <span className="brand-panel__meter">
              <span className="brand-panel__meter-fill" />
            </span>
            <span className="brand-panel__scan-note">
              3 warning signs found
            </span>
          </div>
        </figure>

        <ul className="brand-panel__features">
          {features.map((feature) => (
            <li key={feature} className="brand-panel__feature">
              <span className="brand-panel__check">
                <CheckIcon />
              </span>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
