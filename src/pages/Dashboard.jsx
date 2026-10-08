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
import ShieldLogo from "../components/ShieldLogo.jsx";
import "./Dashboard.css";

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
  // Email subject + body are merged into one field (content). Sender is
  // shared by EMAIL and SMS - each tab keeps its own value so switching
  // tabs doesn't clobber what was typed in the other.
  const [content, setContent] = useState(""); // EMAIL only
  const [emailSender, setEmailSender] = useState(""); // EMAIL only
  const [text, setText] = useState(""); // SMS only
  const [smsSender, setSmsSender] = useState(""); // SMS only
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
    if (activeTab === "EMAIL")
      return {
        scanType: "EMAIL",
        content,
        sender: emailSender.trim() || undefined,
      };
    if (activeTab === "SMS")
      return {
        scanType: "SMS",
        text,
        sender: smsSender.trim() || undefined,
      };
    return { scanType: "URL", url };
  }

  function currentInputEmpty() {
    if (activeTab === "EMAIL") return !content.trim();
    if (activeTab === "SMS") return !text.trim();
    return !url.trim();
  }

  function currentScanText() {
    if (activeTab === "EMAIL") return content;
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
            <ShieldLogo size={22} tick={false} />
          </div>
          <div>
            <h1>SecureShield</h1>
            <p>AI-powered phishing &amp; spam detection</p>
          </div>
        </div>
        <div className="header-actions">
          <span className="status-pill">
            <span className="status-dot" /> MODEL ONLINE
          </span>
          <button type="button" className="btn-logout" onClick={handleLogout}>
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
            {(activeTab === "EMAIL" || activeTab === "SMS") && (
              <div className="field-row">
                <span className="field-label">Sender:</span>
                <input
                  value={activeTab === "EMAIL" ? emailSender : smsSender}
                  onChange={(e) =>
                    activeTab === "EMAIL"
                      ? setEmailSender(e.target.value)
                      : setSmsSender(e.target.value)
                  }
                  placeholder={
                    activeTab === "EMAIL"
                      ? "PayPal Support <help@paypa1-secure.xyz>"
                      : "+91XXXXXXXXXX or VM-HDFCBK"
                  }
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
                value={activeTab === "EMAIL" ? content : text}
                onChange={(e) =>
                  activeTab === "EMAIL"
                    ? setContent(e.target.value)
                    : setText(e.target.value)
                }
                placeholder={
                  activeTab === "EMAIL"
                    ? "Subject: Your account has been suspended\n\nDear user, we detected unusual sign-in activity. Click the link below within 24 hours..."
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
            <div className="scan-error" role="alert">
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

          {result ? (
            <ExplainableAIPanel
              text={scannedText}
              features={result.topFeatures ?? []}
              label={result.label}
              confidence={result.confidence}
              method={result.method}
              phishingProbability={result.phishingProbability}
              riskLevel={result.riskLevel}
              reliability={result.reliability}
              redFlags={result.redFlags ?? []}
              senderAnalysis={result.senderAnalysis ?? null}
              scanType={resultScanType}
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
