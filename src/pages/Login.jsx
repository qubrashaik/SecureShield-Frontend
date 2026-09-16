import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api.js";

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
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Sign in to SecureShield</h1>
        <p className="sub">AI-powered phishing & spam detection</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="auth-switch">
          No account? <Link to="/register">Register</Link>
        </div>
      </div>
    </div>
  );
}
