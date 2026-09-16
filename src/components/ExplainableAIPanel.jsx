import { useMemo } from "react";
import RiskMeter from "./RiskMeter.jsx";
import {
  REASON_ICON_MAP,
  AlertTriangleIcon,
  ShieldCheckIcon,
} from "./Icons.jsx";

/**
 * ExplainableAIPanel
 *
 * A structured XAI display matching the "Explainable AI Analysis" layout:
 *   - Header: label + confidence + risk level
 *   - Top Reasons: flagged words grouped into plain-language categories
 *   - Feature Impact: bar chart of the raw top words/weights
 *   - Highlighted Text: the original message with flagged words colored inline
 *   - AI Reasoning: one-sentence synthesis of the strongest categories
 *
 * Props:
 *   text     - the original message text that was scanned
 *   features - result.topFeatures from the API, i.e. [{ name, value }, ...]
 *              positive value = pushes toward Spam/Phishing
 *              negative value = pushes toward Legitimate
 *   label    - result.label ("Spam/Phishing" | "Legitimate" | "Phishing")
 *   confidence - result.confidence (0-1)
 */

// Category buckets built from what a content-only LIME explanation can
// actually support - no sender/metadata categories, since the model only
// ever sees the message text. Negative-weight words that don't match a
// specific "risky" pattern are bucketed as trust signals.
const CATEGORY_LABELS = {
  url: "Suspicious link",
  urgent: "Urgent / threatening language",
  financial: "Financial or reward bait",
  other: "Suspicious phrasing",
  trusted: "Trusted indicators",
};

const MATCHERS = {
  url: (w) =>
    /^(http|https|www|com|net|org|io|link|click|bit|ly)$/i.test(w) ||
    /^[a-z0-9-]+\.(com|net|org|info|xyz|ru)$/i.test(w),
  urgent: (w) =>
    /^(urgent|verify|immediately|now|act|expire|expires|expired|suspend|suspended|alert|unusual|confirm|blocked|locked|due|limited)$/i.test(
      w,
    ),
  financial: (w) =>
    /^(win|won|prize|free|cash|gift|reward|claim|card|money|bank|account|payment|refund)$/i.test(
      w,
    ),
};

function categorize(word, value) {
  const w = word.toLowerCase();
  if (MATCHERS.url(w)) return "url";
  if (MATCHERS.urgent(w)) return "urgent";
  if (MATCHERS.financial(w)) return "financial";
  if (value < 0) return "trusted";
  return "other";
}

function riskLevel(label, confidence) {
  const flagged = label && label.toLowerCase() !== "legitimate";
  if (!flagged) return null;
  if (confidence >= 0.9) return "High";
  if (confidence >= 0.7) return "Medium";
  return "Low";
}

// Reference scale for "how big does a word's influence look" - based on what
// a genuinely strong signal measures in practice (e.g. "http" in a clear
// phishing message came out around 0.20-0.22). Used instead of normalizing
// each word against the total of just the few words shown, which always
// sums to 100% and makes even negligible weights look like ~17% each when
// 6 words are displayed - exactly what was happening on high-confidence
// Legitimate messages where no single word actually matters.
const REFERENCE_SCALE = 0.2;
// Raised from 0.02: on very high-confidence predictions (e.g. 99%+), LIME's
// local regression has almost no real signal to fit (removing any one word
// barely changes the prediction), so it can produce small, coincidentally
// similar, same-signed weights across totally unrelated words - noise, not
// a real indicator. Observed noise clusters around 0.03-0.04; observed real
// signal (e.g. "http" in a clear phishing message) started around 0.06 and
// went up to ~0.22. 0.05 sits cleanly between the two.
const NEGLIGIBLE_THRESHOLD = 0.05;

const cardStyle = {
  background: "var(--panel-bg, #0f1424)",
  border: "1px solid var(--panel-border, #1f2740)",
  borderRadius: 10,
  padding: "16px 18px",
  marginBottom: 14,
};

const cardTitleStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: "#e2e8f0",
  marginBottom: 10,
};

export default function ExplainableAIPanel({
  text,
  features = [],
  label,
  confidence = 0,
}) {
  const flagged = label && label.toLowerCase() !== "legitimate";

  const sortedFeatures = useMemo(
    () => [...features].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)),
    [features],
  );

  const maxAbsWeight = useMemo(
    () => Math.max(...features.map((f) => Math.abs(f.value)), 0.0001),
    [features],
  );

  const totalAbsWeight = useMemo(
    () => features.reduce((sum, f) => sum + Math.abs(f.value), 0) || 0.0001,
    [features],
  );

  // Group all words into plain-language reason categories, keeping sign so
  // that trust signals (negative) show up alongside risk signals (positive).
  //
  // FIX: previously this showed EVERY category regardless of the overall
  // verdict. With num_samples=200, LIME's local surrogate can assign small
  // positive weights to totally ordinary words (sampling noise) even on a
  // clearly Legitimate message. If none of those words matched a real risk
  // pattern (url/urgent/financial), they all fell into the generic "other"
  // bucket ("Suspicious phrasing"), which could sum to +100% and get shown
  // as the reason - even though the model's actual verdict was Legitimate
  // at high confidence. That's misleading, so the direction shown must now
  // match the verdict: flagged messages only show risk (positive) reasons,
  // Legitimate messages only show trust (negative) reasons. Positive-only
  // noise on a Legitimate result is discarded rather than displayed.
  const topReasons = useMemo(() => {
    // Only aggregate features whose individual weight clears the noise
    // floor, so a category sum can't be built entirely out of LIME
    // sampling noise (see NEGLIGIBLE_THRESHOLD above).
    const significant = sortedFeatures.filter(
      (f) => Math.abs(f.value) >= NEGLIGIBLE_THRESHOLD,
    );
    const totals = new Map(); // key -> summed value
    significant.forEach((f) => {
      const key = categorize(f.name, f.value);
      totals.set(key, (totals.get(key) || 0) + f.value);
    });
    return [...totals.entries()]
      .map(([key, value]) => ({
        key,
        label: CATEGORY_LABELS[key],
        pct: (value / totalAbsWeight) * 100,
      }))
      .filter((r) => Math.abs(r.pct) >= 1)
      .filter((r) => (flagged ? r.pct > 0 : r.pct < 0))
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
      .slice(0, 5);
  }, [sortedFeatures, totalAbsWeight, flagged]);

  const reasoning = useMemo(() => {
    if (!flagged) {
      if (topReasons.length === 0) {
        return "No strong phishing or spam indicators were found in this message.";
      }
      const top2 = topReasons.slice(0, 2).map((r) => r.label.toLowerCase());
      return `Marked Legitimate — no risk indicators found. Trust signals: ${top2.join(", ")}.`;
    }
    if (topReasons.length === 0) {
      return "The model flagged this message, but no single indicator stood out strongly.";
    }
    const top2 = topReasons.slice(0, 2).map((r) => r.label.toLowerCase());
    return `The strongest indicators were ${top2.join(" and ")}.`;
  }, [flagged, topReasons]);

  const weightByWord = useMemo(() => {
    const map = new Map();
    features.forEach((f) => map.set(String(f.name).toLowerCase(), f.value));
    return map;
  }, [features]);

  const tokens = useMemo(() => {
    if (!text) return [];
    return text.split(/(\s+|[.,!?;:()"'])/g).filter((t) => t !== "");
  }, [text]);

  const wordStyle = (weight) => {
    const intensity = Math.min(Math.abs(weight) / maxAbsWeight, 1);
    const isSpamPush = weight > 0;
    const bg = isSpamPush
      ? `rgba(244, 63, 94, ${0.15 + intensity * 0.45})`
      : `rgba(52, 211, 153, ${0.15 + intensity * 0.45})`;
    const border = isSpamPush
      ? `rgba(244, 63, 94, ${0.4 + intensity * 0.6})`
      : `rgba(52, 211, 153, ${0.4 + intensity * 0.6})`;
    return {
      backgroundColor: bg,
      border: `1px solid ${border}`,
      borderRadius: 4,
      padding: "0 3px",
    };
  };

  const risk = riskLevel(label, confidence);

  // Risk-meter reading: for flagged content, higher confidence = higher risk.
  // For legitimate content, higher confidence = lower risk.
  const riskValue = flagged
    ? confidence * 100
    : Math.max(0, (1 - confidence) * 100);
  const riskBadge =
    riskValue > 70
      ? {
          text: "High Risk",
          color: "#f43f5e",
          bg: "rgba(244, 63, 94, 0.12)",
          border: "rgba(244, 63, 94, 0.4)",
        }
      : riskValue > 30
        ? {
            text: "Suspicious",
            color: "#e2a13a",
            bg: "rgba(226, 161, 58, 0.12)",
            border: "rgba(226, 161, 58, 0.4)",
          }
        : {
            text: "Safe",
            color: "#34d399",
            bg: "rgba(52, 211, 153, 0.12)",
            border: "rgba(52, 211, 153, 0.4)",
          };

  if (!text || features.length === 0) return null;

  return (
    <div>
      {/* Header */}
      <div style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: flagged
                  ? "rgba(244, 63, 94, 0.12)"
                  : "rgba(52, 211, 153, 0.12)",
                color: flagged ? "#f43f5e" : "#34d399",
              }}
            >
              {flagged ? (
                <AlertTriangleIcon width={18} height={18} />
              ) : (
                <ShieldCheckIcon width={18} height={18} />
              )}
            </div>
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: flagged ? "#f43f5e" : "#34d399",
                }}
              >
                {flagged ? `${label} Detected` : label}
              </div>
              <div style={{ fontSize: 13, color: "#8b94ab", marginTop: 2 }}>
                Confidence: {(confidence * 100).toFixed(0)}%
              </div>
            </div>
          </div>
          {risk && (
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 999,
                color: riskBadge.color,
                background: riskBadge.bg,
                border: `1px solid ${riskBadge.border}`,
                whiteSpace: "nowrap",
              }}
            >
              {riskBadge.text}
            </span>
          )}
        </div>
      </div>

      {/* Risk Meter */}
      <div style={cardStyle}>
        <div style={{ ...cardTitleStyle, textAlign: "center" }}>Risk Meter</div>
        <RiskMeter value={riskValue} />
      </div>

      {/* Top Reasons */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Top Reasons</div>
        {topReasons.length > 0 ? (
          <div>
            {topReasons.map((r) => {
              const { Icon, color } = REASON_ICON_MAP[r.key];
              const widthPct = Math.min(100, Math.abs(r.pct));
              return (
                <div
                  key={r.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      flexShrink: 0,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: `${color}22`,
                      color,
                    }}
                  >
                    <Icon width={12} height={12} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "#cbd5e1",
                        marginBottom: 3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.label}
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "#1a2036",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${widthPct}%`,
                          height: "100%",
                          background: color,
                          borderRadius: 4,
                        }}
                      />
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 11.5,
                      width: 42,
                      textAlign: "right",
                      flexShrink: 0,
                      color: "#8b94ab",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {r.pct > 0 ? "+" : ""}
                    {r.pct.toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 13.5, color: "#8b94ab" }}>
            {flagged
              ? "No notable indicators found."
              : "No suspicious indicators found."}
          </div>
        )}
      </div>

      {/* Feature Impact */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Feature Impact</div>
        {sortedFeatures.slice(0, 6).map((f) => {
          const isSpamPush = f.value > 0;
          const isNegligible = Math.abs(f.value) < NEGLIGIBLE_THRESHOLD;
          const widthPct = Math.round(
            Math.min(1, Math.abs(f.value) / REFERENCE_SCALE) * 100,
          );
          const scaledPct = (f.value / REFERENCE_SCALE) * 100;
          return (
            <div key={f.name} style={{ marginBottom: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 11,
                  color: "#8b94ab",
                  marginBottom: 3,
                }}
              >
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.name}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    flexShrink: 0,
                    marginLeft: 6,
                  }}
                >
                  {isNegligible
                    ? "negligible"
                    : `${scaledPct > 0 ? "+" : ""}${scaledPct.toFixed(0)}%`}
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  background: "#1a2036",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
                title={`${f.name}: ${f.value.toFixed(4)}`}
              >
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: "100%",
                    background: isNegligible
                      ? "#4b5568"
                      : isSpamPush
                        ? "#f43f5e"
                        : "#34d399",
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Highlighted Text */}
      <div style={cardStyle}>
        <div style={cardTitleStyle}>Highlighted Text</div>
        <div
          style={{
            fontFamily: "monospace",
            fontSize: 13.5,
            lineHeight: 1.9,
            whiteSpace: "pre-wrap",
            color: "#cbd5e1",
          }}
        >
          &ldquo;
          {tokens.map((token, i) => {
            const key = token.trim().toLowerCase();
            const weight = weightByWord.get(key);
            const isNegligibleWord =
              weight === undefined || Math.abs(weight) < NEGLIGIBLE_THRESHOLD;
            if (isNegligibleWord || /^\s+$/.test(token)) {
              return <span key={i}>{token}</span>;
            }
            return (
              <span key={i} style={wordStyle(weight)}>
                {token}
              </span>
            );
          })}
          &rdquo;
        </div>
      </div>

      {/* AI Reasoning */}
      <div
        style={{
          ...cardStyle,
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(139,92,246,0.10))",
          border: "1px solid rgba(99,102,241,0.35)",
        }}
      >
        <div
          style={{
            ...cardTitleStyle,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 22,
              height: 22,
              borderRadius: 6,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(99,102,241,0.18)",
              color: "#818cf8",
              fontSize: 12,
            }}
          >
            ✦
          </span>
          AI Reasoning
        </div>
        <div style={{ fontSize: 13.5, color: "#cbd5e1", lineHeight: 1.6 }}>
          {reasoning}
        </div>
      </div>
    </div>
  );
}
