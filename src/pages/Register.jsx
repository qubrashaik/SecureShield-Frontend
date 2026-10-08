import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api.js";
import AuthLayout from "../components/AuthLayout.jsx";

// Text for the left-hand brand panel
const BRAND = {
  headline: "Stay Protected From Digital Threats",
  tagline:
    "Create your SecureShield account and use AI-powered detection to identify suspicious emails, SMS messages, and URLs.",
  features: [
    "Detect phishing attempts",
    "Identify spam messages",
    "Understand AI predictions",
  ],
};

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.register(username, email, password);

      api.setToken(res.token);

      // After successful registration, go to Dashboard
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      brand={BRAND}
      title="Create your account"
      subtitle="Get started with SecureShield and stay protected."
      error={error}
      footer={
        <>
          Already have an account? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="auth-form__field">
          <span className="auth-form__label">Username</span>
          <input
            className="auth-form__input"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Choose a username"
            autoComplete="username"
            required
            minLength={3}
          />
        </label>

        <label className="auth-form__field">
          <span className="auth-form__label">Email</span>
          <input
            className="auth-form__input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
            required
          />
        </label>

        <label className="auth-form__field">
          <span className="auth-form__label">Password</span>
          <input
            className="auth-form__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password"
            autoComplete="new-password"
            required
            minLength={6}
          />
        </label>

        <button
          type="submit"
          className="btn-primary auth-form__submit"
          disabled={loading}
        >
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
