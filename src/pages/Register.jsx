import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api.js";

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
        <h1>Create your account</h1>
        <p className="sub">Get started with SecureShield</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
          </div>
          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div className="auth-switch">
          Already have an account? <Link to="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
