import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api.js";
import AuthLayout from "../components/AuthLayout.jsx";

// Text for the left-hand brand panel
const BRAND = {
  headline: "AI-Powered Phishing & Spam Detection",
  tagline:
    "Protect yourself from phishing, spam, and malicious content using intelligent machine learning models.",
  features: [
    "AI-powered threat detection",
    "Email, SMS & URL scanning",
    "Explainable AI predictions",
  ],
};

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.login(username, password);

      api.setToken(res.token);

      // After successful login, go to Dashboard
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
      title="Welcome back"
      subtitle="Sign in to continue to your SecureShield dashboard."
      error={error}
      footer={
        <>
          Don't have an account? <Link to="/register">Create an account</Link>
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
            placeholder="Enter your username"
            autoComplete="username"
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
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />
        </label>

        <button
          type="submit"
          className="btn-primary auth-form__submit"
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
