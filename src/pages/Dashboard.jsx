import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import ExplainableAIPanel from "../components/ExplainableAIPanel.jsx";
import {
  ScanIcon,
  AlertTriangleIcon,
  MailWarningIcon,
  ShieldCheckIcon,
} from "../components/Icons.jsx";

const TABS = ["EMAIL", "SMS", "URL"];

function labelClass(label) {
  if (!label) return "";
  if (label.toLowerCase() === "legitimate") return "legit";
  if (label.toLowerCase() === "phishing") return "phishing";
  return "spam"; // "Spam/Phishing" from the email/sms models
}

function isSameDay(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("EMAIL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [resultScanType, setResultScanType] = useState(null);
  const [scannedText, setScannedText] = useState("");
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    try {
      const data = await api.history();
      setHistory(data);
    } catch (err) {
      // if the token's stale, bounce to login
      if (
        String(err.message).toLowerCase().includes("403") ||
        String(err.message).toLowerCase().includes("401")
      ) {
        api.clearToken();
        navigate("/login");
      }
    }
  }

  const stats = useMemo(() => {
    const today = history.filter((h) => isSameDay(h.createdAt));
    const phishing = history.filter(
      (h) => labelClass(h.label) === "phishing",
    ).length;
    const spam = history.filter((h) => labelClass(h.label) === "spam").length;
    const legit = history.filter((h) => labelClass(h.label) === "legit").length;
    return { scansToday: today.length, phishing, spam, legit };
  }, [history]);

  function currentPayload() {
    if (activeTab === "EMAIL") return { scanType: "EMAIL", subject, body };
    if (activeTab === "SMS") return { scanType: "SMS", text };
    return { scanType: "URL", url };
  }

  function currentInputEmpty() {
    if (activeTab === "EMAIL") return !subject.trim() && !body.trim();
    if (activeTab === "SMS") return !text.trim();
    return !url.trim();
  }

  function currentScanText() {
    if (activeTab === "EMAIL")
      return [subject, body].filter(Boolean).join("\n");
    if (activeTab === "SMS") return text;
    return url;
  }

  async function handleScan() {
    setError("");
    setResult(null);
    setScanning(true);
    const scanType = activeTab;
    const textAtScanTime = currentScanText();
    try {
      const res = await api.scan(currentPayload());
      setResult(res);
      setResultScanType(scanType);
      setScannedText(textAtScanTime);
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  }

  function handleLogout() {
    api.clearToken();
    navigate("/login");
  }

  const maxFeatureAbs = result?.topFeatures?.length
    ? Math.max(...result.topFeatures.map((f) => Math.abs(f.value)))
    : 1;

  return (
    <div className="page">
      <div className="header">
        <div className="brand">
          <div className="brand-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2L4 5v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3z"
                stroke="#5b8def"
                strokeWidth="1.6"
                fill="rgba(59,130,246,0.12)"
              />
            </svg>
          </div>
          <div>
            <h1>SecureShield</h1>
            <p>AI-powered phishing &amp; spam detection</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="status-pill">
            <span className="status-dot" /> MODEL ONLINE
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: "transparent",
              border: "1px solid var(--panel-border)",
              color: "var(--text-muted)",
              borderRadius: 7,
              padding: "6px 12px",
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      </div>

      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-icon blue">
            <ScanIcon width={16} height={16} />
          </div>
          <div className="label">Scans today</div>
          <div className="value">{stats.scansToday}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">
            <AlertTriangleIcon width={16} height={16} />
          </div>
          <div className="label">Phishing flagged</div>
          <div className="value red">{stats.phishing}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <MailWarningIcon width={16} height={16} />
          </div>
          <div className="label">Spam flagged</div>
          <div className="value amber">{stats.spam}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <ShieldCheckIcon width={16} height={16} />
          </div>
          <div className="label">Legitimate</div>
          <div className="value green">{stats.legit}</div>
        </div>
      </div>

      <div className="main-grid">
        {/* LEFT: input panel */}
        <div className="panel">
          <p className="panel-title">Incoming content</p>

          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t}
                className={`tab ${activeTab === t ? "active" : ""}`}
                onClick={() => {
                  setActiveTab(t);
                  setResult(null);
                  setError("");
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="content-box">
            {activeTab === "EMAIL" && (
              <div className="field-row">
                <span className="field-label">Subject:</span>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Your account has been suspended"
                />
              </div>
            )}
            {activeTab === "URL" && (
              <div className="field-row">
                <span className="field-label">URL:</span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="http://paypal-secure-alert.com/login"
                />
              </div>
            )}
            {activeTab !== "URL" && (
              <textarea
                value={activeTab === "EMAIL" ? body : text}
                onChange={(e) =>
                  activeTab === "EMAIL"
                    ? setBody(e.target.value)
                    : setText(e.target.value)
                }
                placeholder={
                  activeTab === "EMAIL"
                    ? "Dear user, we detected unusual sign-in activity. Click the link below within 24 hours..."
                    : "URGENT! You've won a prize, claim now..."
                }
              />
            )}
          </div>

          <div className="scan-actions">
            <button
              className="btn-primary"
              onClick={handleScan}
              disabled={scanning || currentInputEmpty()}
            >
              {scanning ? "Analyzing..." : "Analyze"}
            </button>
          </div>

          {scanning && (
            <div className="analyzing">
              <div className="spinner" />
              <div>
                <div className="title">Analyzing...</div>
                <div className="sub">Running NLP + ML classifiers</div>
              </div>
            </div>
          )}

          {error && (
            <div className="auth-error" style={{ marginTop: 16 }}>
              {error}
            </div>
          )}

          {result && !scanning && (
            <div className={`result-banner ${labelClass(result.label)}`}>
              <div>
                <div className="label">{result.label}</div>
                <div className="confidence">
                  confidence {(result.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: XAI + history panel */}
        <div className="panel">
          <p className="panel-title">Why this prediction (XAI)</p>

          {result?.topFeatures?.length ? (
            <ExplainableAIPanel
              text={scannedText}
              features={result.topFeatures}
              label={result.label}
              confidence={result.confidence}
            />
          ) : null}

          {!result?.topFeatures?.length && (
            <div className="empty-state">
              Run a scan to see which features drove the prediction.
            </div>
          )}

          <hr className="section-divider" />
          <p className="panel-title">Recent scans</p>

          {history.length === 0 ? (
            <div className="empty-state">No scans yet.</div>
          ) : (
            history.slice(0, 8).map((h) => (
              <div className="history-row" key={h.id}>
                <span>
                  <span className="type-badge">{h.scanType}</span>
                  <span className="snippet">
                    {new Date(h.createdAt).toLocaleString()}
                  </span>
                </span>
                <span className={`history-label ${labelClass(h.label)}`}>
                  {h.label}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
