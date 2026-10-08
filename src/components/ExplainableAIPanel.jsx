import { useMemo } from "react";
import RiskMeter from "./RiskMeter.jsx";
import {
  REASON_ICON_MAP,
  AlertTriangleIcon,
  ShieldCheckIcon,
} from "./Icons.jsx";
import "./ExplainableAIPanel.css";

/**
 * ExplainableAIPanel
 *
 * Props:
 *   text     - the original message text that was scanned
 *   features - explanation items from the API (result.topFeatures). Each item:
 *                { name, value }                                  (old shape, still works)
 *              plus, from the new Flask response (any of these may be missing):
 *                { label, kind, token, direction, impact_pct | impactPct }
 *              value > 0 / direction "phishing"    = pushes toward Spam/Phishing
 *              value < 0 / direction "legitimate"  = pushes toward Legitimate
 *   label    - result.label ("Spam/Phishing" | "Spam" | "Phishing" | "Legitimate")
 *   confidence - result.confidence (0-1), confidence in `label`
 *
 * Optional props (forward these from the backend when you can; the panel
 * derives sensible fallbacks when they are missing):
 *   method               - "SHAP" | "LIME"  (xai_data.method)
 *   phishingProbability  - 0-1, probability of the malicious class
 *   riskLevel            - "Safe" | "Suspicious" | "High Risk"
 *   reliability          - { level: "low" | "normal", note }
 *   redFlags             - plain-English warning signs from the backend:
 *                            [{ key, title, phrases: ["exact text from message", ...] }]
 *                          (Flask sends this as `red_flags`; Spring Boot may
 *                          expose it as `redFlags`.)
 *   senderAnalysis       - sender risk check, EMAIL + SMS only (Flask's
 *                          `sender_analysis`, exposed by Spring Boot as
 *                          `senderAnalysis`). Shape:
 *                            { provided, risk, level: "low"|"medium"|"high",
 *                              trusted, flags: [{key,title,phrases}], ... }
 *                          Omitted or { provided: false } when no sender was
 *                          entered - the card is simply not shown.
 *
 * Styling lives in ExplainableAIPanel.css (all classes are prefixed `xai-`).
 * The only inline styles left are CSS variables for values computed at
 * runtime (bar widths, highlight intensity, icon colour).
 */

// ---------------------------------------------------------------
// Tunable constants
// ---------------------------------------------------------------
// LIME (SMS) / legacy path: raw weights, calibrated as before.
//   REFERENCE_SCALE      = raw weight that fills a bar (strong signal ~0.2)
//   NEGLIGIBLE_THRESHOLD = below this it is sampling noise (noise ~0.03-0.04)
const REFERENCE_SCALE = 0.2;
const NEGLIGIBLE_THRESHOLD = 0.05;

// SHAP (email / URL) path: the backend sends impact_pct = share of the model's
// total attribution, so it is independent of SHAP's units.
//   REFERENCE_SHARE  = a feature carrying this % of the decision fills its bar
//   NEGLIGIBLE_SHARE = below this % it is shown as "minor"
const REFERENCE_SHARE = 30;
const NEGLIGIBLE_SHARE = 4;

// Risk band -> CSS modifier (colours are defined in the CSS file).
const BAND_CLASS = {
  "High Risk": "high",
  Suspicious: "suspicious",
  Safe: "safe",
};

// ---------------------------------------------------------------
// Categorisation (only used to pick an icon for each reason)
// ---------------------------------------------------------------
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

// Engineered (non-word) features from the email and URL models.
const SIGNAL_CATEGORY = {
  has_url: "url",
  is_shortened: "url",
  has_ip: "url",
  num_at: "url",
  num_subdomains: "url",
  num_dots: "url",
  num_hyphens: "url",
  num_subdirs: "url",
  num_params: "url",
  url_length: "url",
  num_digits: "url",
  unique_char_ratio: "url",
  urgency_flag: "urgent",
  suspicious_word_count: "urgent",
};

function categoryOf(item) {
  if (item.direction === "legitimate") return "trusted";
  if (item.kind === "signal") return SIGNAL_CATEGORY[item.name] || "other";
  const w = String(item.token || item.name).toLowerCase();
  if (MATCHERS.url(w)) return "url";
  if (MATCHERS.urgent(w)) return "urgent";
  if (MATCHERS.financial(w)) return "financial";
  return "other";
}

// Accepts both the old {name, value} shape and the new labelled shape,
// snake_case (Flask) or camelCase (Spring Boot).
function normalizeFeature(f) {
  const value = Number(f.value) || 0;
  const name = String(f.name);
  const kind = f.kind || "token";
  return {
    name,
    label: f.label || name,
    kind,
    token: f.token !== undefined ? f.token : kind === "token" ? name : null,
    direction: f.direction || (value > 0 ? "phishing" : "legitimate"),
    value,
    impactPct: f.impact_pct ?? f.impactPct,
  };
}

// Class + CSS variable for a highlighted word in the "Highlighted Text" card.
// Colour comes from the modifier class; --intensity (0-1) drives the opacity.
function wordProps(item) {
  const tone = item.direction === "phishing" ? "risk" : "safe";
  return {
    className: `xai-word xai-word--${tone}`,
    style: { "--intensity": Math.min(item.barPct / 100, 1) },
  };
}

function Legend() {
  return (
    <div className="xai-legend">
      <span>
        <span className="xai-legend__dot xai-legend__dot--risk" />
        pushes toward spam / phishing
      </span>
      <span>
        <span className="xai-legend__dot xai-legend__dot--safe" />
        pushes toward legitimate
      </span>
    </div>
  );
}

// Escapes a phrase for use inside a RegExp, and lets any run of spaces match
// any whitespace (the panel text may contain line breaks the backend did not).
function phraseToPattern(p) {
  return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

export default function ExplainableAIPanel({
  text,
  features = [],
  label,
  confidence = 0,
  method,
  phishingProbability,
  riskLevel,
  reliability,
  redFlags = [],
  senderAnalysis = null,
  scanType,
}) {
  const flagged = !!label && label.toLowerCase() !== "legitimate";
  const lowInfo = reliability?.level === "low";
  const flags = Array.isArray(redFlags) ? redFlags : [];

  // Only render the sender card when a sender was actually entered.
  const senderProvided = !!senderAnalysis?.provided;
  const senderFlags =
    senderProvided && Array.isArray(senderAnalysis.flags)
      ? senderAnalysis.flags
      : [];
  const senderBandKey =
    senderAnalysis?.level === "high"
      ? "high"
      : senderAnalysis?.level === "medium"
        ? "suspicious"
        : "safe";
  const senderBandLabel =
    senderAnalysis?.level === "high"
      ? "High risk"
      : senderAnalysis?.level === "medium"
        ? "Worth checking"
        : senderAnalysis?.trusted
          ? "Recognised"
          : "Looks normal";

  // Normalise every item and give it a scale-independent impact (0-100).
  const items = useMemo(() => {
    const norm = features.map(normalizeFeature);
    // SHAP items carry impact_pct as a share of the whole decision. LIME (and
    // the old API) only have raw weights, so they keep the calibrated
    // raw-weight scale. If `method` isn't forwarded, engineered "signal"
    // items identify the SHAP channels.
    // Old scans loaded from history have no impact_pct, so they always fall
    // back to the raw-weight scale.
    const hasShares = norm.some((i) => i.impactPct != null);
    const isShare =
      hasShares &&
      (method
        ? String(method).toUpperCase() === "SHAP"
        : norm.some((i) => i.kind === "signal"));

    return norm
      .map((i) => {
        const impact = isShare
          ? (i.impactPct ?? 0)
          : Math.min(100, (Math.abs(i.value) / REFERENCE_SCALE) * 100);
        const minor = isShare
          ? impact < NEGLIGIBLE_SHARE
          : Math.abs(i.value) < NEGLIGIBLE_THRESHOLD;
        const barPct = isShare
          ? Math.min(100, (impact / REFERENCE_SHARE) * 100)
          : impact;
        return { ...i, impact, minor, barPct, category: categoryOf(i) };
      })
      .sort((a, b) => b.impact - a.impact);
  }, [features, method]);

  // Reasons must agree with the verdict: flagged -> what pushed toward risk,
  // Legitimate -> what pushed toward safe. Noise-level items are dropped.
  const topReasons = useMemo(() => {
    const want = flagged ? "phishing" : "legitimate";
    return items.filter((i) => i.direction === want && !i.minor).slice(0, 4);
  }, [items, flagged]);

  // Technical details list: only factors that actually carried weight.
  // "Minor" rows and "absence" rows are noise to a normal user.
  const visibleItems = useMemo(
    () => items.filter((i) => !i.minor).slice(0, 6),
    [items],
  );

  // word (lowercase) -> item, strongest item wins. Multi-word n-grams such as
  // "click here" highlight each of their words.
  const highlightMap = useMemo(() => {
    const map = new Map();
    items.forEach((i) => {
      if (!i.token || i.minor) return;
      String(i.token)
        .toLowerCase()
        .split(/\s+/)
        .forEach((w) => {
          if (w && !map.has(w)) map.set(w, i);
        });
    });
    return map;
  }, [items]);

  const tokens = useMemo(() => {
    if (!text) return [];
    return text.split(/(\s+|[.,!?;:()"'])/g).filter((t) => t !== "");
  }, [text]);

  // Splits the text around the red-flag phrases so they can be highlighted.
  // Returns null when there is nothing to highlight (falls back to word-level
  // highlighting from the model).
  const segments = useMemo(() => {
    if (!text) return null;
    const phrases = flags.flatMap((f) => f.phrases || []).filter(Boolean);
    if (phrases.length === 0) return null;
    const pattern = [...phrases]
      .sort((a, b) => b.length - a.length)
      .map(phraseToPattern)
      .join("|");
    try {
      return text
        .split(new RegExp(`(${pattern})`, "gi"))
        .map((part, i) => ({ part, hit: i % 2 === 1 }))
        .filter((s) => s.part !== "");
    } catch {
      return null;
    }
  }, [text, flags]);

  // Risk = probability of the malicious class (backend value if provided).
  const pMalicious =
    phishingProbability != null
      ? Number(phishingProbability)
      : flagged
        ? confidence
        : 1 - confidence;
  const riskValue = Math.max(0, Math.min(100, pMalicious * 100));
  const band =
    riskLevel ||
    (riskValue > 70 ? "High Risk" : riskValue > 30 ? "Suspicious" : "Safe");
  const bandKey = BAND_CLASS[band] || BAND_CLASS.Suspicious;

  // Wording follows the band, so "Detected" is only used for High Risk.
  const headline =
    band === "High Risk"
      ? `${label} Detected`
      : band === "Suspicious"
        ? flagged
          ? `Possible ${label}`
          : "Likely Legitimate"
        : label;
  const confidencePct = (confidence * 100).toFixed(0);

  const reasoning = useMemo(() => {
    if (lowInfo) {
      return "There was too little content for the model to work with, so treat this score as a weak guess. Try a fuller message.";
    }

    // Plain-English summary built from the warning signs that were found.
    if (flags.length > 0) {
      const parts = flags
        .slice(0, 3)
        .map((f) => f.title.charAt(0).toLowerCase() + f.title.slice(1));
      const list =
        parts.length > 1
          ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`
          : parts[0];
      const isUrl = scanType === "URL";
      const what = isUrl
        ? "link"
        : scanType === "SMS"
          ? "text message"
          : "message";
      return flagged
        ? `This ${what} ${list}. These are common tactics in phishing and scam ${isUrl ? "links" : "messages"}.`
        : `Marked Legitimate, but this ${what} ${list}. Double-check ${isUrl ? "the link" : "the sender"} before you act on it.`;
    }

    const factors = topReasons
      .slice(0, 2)
      .map((r) => r.label)
      .join("; ");
    if (flagged) {
      return factors
        ? `The model leans ${label} mainly because of: ${factors}.`
        : "The model flagged this message from its overall pattern, but no single word or feature stood out strongly.";
    }
    return factors
      ? `Marked Legitimate. Factors in its favour: ${factors}.`
      : "No strong phishing or spam indicators were found in this message.";
  }, [lowInfo, flagged, label, topReasons, flags, scanType]);

  const signedPct = (item) =>
    `${item.direction === "phishing" ? "+" : "\u2212"}${item.impact.toFixed(0)}%`;

  if (!text) return null;

  const hasHighlights = tokens.some((t) =>
    highlightMap.has(t.trim().toLowerCase()),
  );

  return (
    <div className="xai-panel">
      {/* Header */}
      <div className="xai-card">
        <div
          className={`xai-header xai-band--${bandKey} ${
            flagged ? "xai-header--flagged" : "xai-header--clear"
          }`}
        >
          <div className="xai-header__main">
            <div className="xai-header__icon">
              {flagged ? (
                <AlertTriangleIcon width={18} height={18} />
              ) : (
                <ShieldCheckIcon width={18} height={18} />
              )}
            </div>
            <div>
              <div className="xai-header__headline">{headline}</div>
              <div className="xai-header__meta">
                {band === "Suspicious"
                  ? `Leans ${label} \u00b7 Confidence ${confidencePct}%`
                  : `Confidence: ${confidencePct}%`}
              </div>
            </div>
          </div>
          <span className="xai-badge">{band}</span>
        </div>
      </div>

      {/* Low-information warning */}
      {lowInfo && (
        <div className="xai-card xai-card--warn">
          <span className="xai-warn__icon">
            <AlertTriangleIcon width={16} height={16} />
          </span>
          <div>
            <div className="xai-warn__title">Limited analysis</div>
            <div className="xai-warn__note">
              {reliability?.note ||
                "Too little content to analyse reliably. Treat this result as a weak guess."}
            </div>
          </div>
        </div>
      )}

      {/* Risk Meter */}
      <div className="xai-card">
        <div className="xai-card__title xai-card__title--center">
          Risk Meter
        </div>
        <RiskMeter value={riskValue} />
      </div>

      {/* Sender check (EMAIL + SMS only, only when a sender was entered) */}
      {senderProvided && (
        <div className="xai-card">
          <div
            className={`xai-header xai-band--${senderBandKey} ${
              senderBandKey === "safe"
                ? "xai-header--clear"
                : "xai-header--flagged"
            }`}
            style={{ marginBottom: senderFlags.length ? "0.5rem" : 0 }}
          >
            <div className="xai-header__main">
              <div className="xai-header__icon">
                {senderAnalysis.level === "high" ||
                senderAnalysis.level === "medium" ? (
                  <AlertTriangleIcon width={16} height={16} />
                ) : (
                  <ShieldCheckIcon width={16} height={16} />
                )}
              </div>
              <div>
                <div className="xai-header__headline">Sender check</div>
                <div className="xai-header__meta">
                  {senderAnalysis.raw || senderAnalysis.address || ""}
                </div>
              </div>
            </div>
            <span className="xai-badge">{senderBandLabel}</span>
          </div>

          {senderFlags.length > 0 ? (
            <div>
              {senderFlags.map((f) => (
                <div key={f.key} className="xai-flag">
                  <div className="xai-flag__title">{f.title}</div>
                  <div className="xai-flag__phrases">
                    {(f.phrases || []).map((p) => (
                      <span key={p} className="xai-chip">
                        &ldquo;{p}&rdquo;
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="xai-empty">
              {senderAnalysis.trusted
                ? "This sender matches a recognised domain. A pasted address can still be forged, so stay cautious with anything it asks you to do."
                : "No sender warning signs found."}
            </div>
          )}
        </div>
      )}

      {/* Warning signs / Top Reasons */}
      <div className="xai-card">
        <div className="xai-card__title">
          {flags.length > 0
            ? flagged
              ? "Warning signs found"
              : "Worth double-checking"
            : flagged
              ? "Why it was flagged"
              : "Why it looks safe"}
        </div>

        {flags.length > 0 ? (
          <div>
            {flags.map((f) => (
              <div key={f.key} className="xai-flag">
                <div className="xai-flag__title">{f.title}</div>
                <div className="xai-flag__phrases">
                  {(f.phrases || []).map((p) => (
                    <span key={p} className="xai-chip">
                      &ldquo;{p}&rdquo;
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : topReasons.length > 0 ? (
          <div>
            {topReasons.map((r) => {
              const { Icon, color } = REASON_ICON_MAP[r.category];
              return (
                <div
                  key={r.name}
                  className="xai-reason"
                  style={{ "--reason-color": color, "--bar": `${r.barPct}%` }}
                >
                  <span className="xai-reason__icon">
                    <Icon width={12} height={12} />
                  </span>
                  <div className="xai-reason__body">
                    <div className="xai-reason__label" title={r.label}>
                      {r.label}
                    </div>
                    <div className="xai-bar xai-bar--sm">
                      <div className="xai-bar__fill xai-bar__fill--reason" />
                    </div>
                  </div>
                  <span className="xai-reason__pct">{signedPct(r)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="xai-empty">
            {lowInfo
              ? "Not enough content to point to specific indicators."
              : flagged
                ? "No single indicator stood out. The score reflects the overall pattern of the message."
                : "No suspicious indicators found."}
          </div>
        )}
      </div>

      {/* Technical details (collapsed): what the model weighed */}
      <div className="xai-card">
        <details>
          <summary className="xai-card__title xai-details__summary">
            Technical details: what the model weighed
          </summary>
          <div className="xai-details__body">
            {visibleItems.length === 0 ? (
              <div className="xai-empty">
                {items.length === 0
                  ? "No detailed breakdown is available for this scan."
                  : "No individual factor was strong enough to list."}
              </div>
            ) : (
              <>
                <Legend />
                {visibleItems.map((f) => {
                  const tone = f.direction === "phishing" ? "risk" : "safe";
                  return (
                    <div key={f.name} className="xai-factor">
                      <div className="xai-factor__head">
                        <span className="xai-factor__label" title={f.label}>
                          {f.label}
                        </span>
                        <span className="xai-factor__pct">{signedPct(f)}</span>
                      </div>
                      <div
                        className="xai-bar"
                        title={`${f.name}: ${f.value.toFixed(4)}`}
                        style={{ "--bar": `${Math.max(f.barPct, 2)}%` }}
                      >
                        <div
                          className={`xai-bar__fill xai-bar__fill--${tone}`}
                        />
                      </div>
                    </div>
                  );
                })}
                <div className="xai-footnote">
                  Percentages show each factor&apos;s share of the model&apos;s
                  decision, not a probability.
                </div>
              </>
            )}
          </div>
        </details>
      </div>

      {/* Highlighted Text */}
      <div className="xai-card">
        <div className="xai-card__title">Highlighted Text</div>
        {segments ? (
          <div className="xai-hint">
            Highlighted phrases are the warning signs listed above.
          </div>
        ) : (
          hasHighlights && <Legend />
        )}
        <div className="xai-quote">
          &ldquo;
          {segments
            ? segments.map((s, i) =>
                s.hit ? (
                  <span key={i} className="xai-flag-mark">
                    {s.part}
                  </span>
                ) : (
                  <span key={i}>{s.part}</span>
                ),
              )
            : tokens.map((token, i) => {
                const item = highlightMap.get(token.trim().toLowerCase());
                if (!item || /^\s+$/.test(token)) {
                  return <span key={i}>{token}</span>;
                }
                return (
                  <span key={i} {...wordProps(item)} title={item.label}>
                    {token}
                  </span>
                );
              })}
          &rdquo;
        </div>
        {!segments && !hasHighlights && (
          <div className="xai-note">
            {items.some((i) => i.kind === "token")
              ? "No individual words influenced the result strongly."
              : "This result is driven by overall features (see Technical details), not individual words."}
          </div>
        )}
      </div>

      {/* AI Reasoning */}
      <div className="xai-card xai-card--reasoning">
        <div className="xai-card__title xai-reasoning__title">
          <span className="xai-reasoning__icon">✦</span>
          AI Reasoning
        </div>
        <div className="xai-reasoning__body">{reasoning}</div>
      </div>
    </div>
  );
}
