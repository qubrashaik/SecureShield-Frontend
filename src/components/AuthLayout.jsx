import AuthbrandPanel from "./AuthbrandPanel.jsx";
import ShieldLogo from "./ShieldLogo.jsx";
import "./AuthLayout.css";

/**
 * AuthLayout
 *
 * Shared shell for Login and Register: brand panel on the left, form card on
 * the right. The pages only supply their own text and form fields.
 *
 * Props:
 *   brand    - { headline, tagline, features } for the left panel
 *   title    - heading inside the card ("Welcome back")
 *   subtitle - one line under the heading
 *   error    - error message to show above the form (empty = none)
 *   footer   - line under the form, e.g. "No account? <Link>Create one</Link>"
 *   children - the <form>
 *
 * Form pieces (auth-form, auth-form__field, ...) are styled in AuthLayout.css.
 */
export default function AuthLayout({
  brand,
  title,
  subtitle,
  error,
  footer,
  children,
}) {
  return (
    <div className="auth-layout">
      <AuthbrandPanel {...brand} />

      <main className="auth-layout__main">
        <div className="auth-layout__card">
          <div className="auth-layout__mobile-brand">
            <span className="auth-layout__mobile-logo">
              <ShieldLogo size={24} />
            </span>
            <span>SecureShield</span>
          </div>

          <header className="auth-layout__heading">
            <h1 className="auth-layout__title">{title}</h1>
            <p className="auth-layout__subtitle">{subtitle}</p>
          </header>

          {error && (
            <div className="auth-form__error" role="alert">
              {error}
            </div>
          )}

          {children}

          <p className="auth-layout__switch">{footer}</p>
        </div>
      </main>
    </div>
  );
}
