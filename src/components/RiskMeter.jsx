import { useMemo } from "react";

/**
 * RiskMeter
 *
 * Semicircle gauge showing a 0-100 risk score with a green -> amber -> red
 * gradient track, a marker dot at the current value, and a Safe /
 * Suspicious / High Risk legend underneath — matching the reference
 * "Risk Meter" card.
 *
 * Props:
 *   value - 0-100 risk score (higher = riskier)
 */
export default function RiskMeter({ value = 0 }) {
  const clamped = Math.max(0, Math.min(100, value));

  const bucket = useMemo(() => {
    if (clamped <= 30) return { label: "Safe", color: "#34d399" };
    if (clamped <= 70) return { label: "Suspicious", color: "#e2a13a" };
    return { label: "High Risk", color: "#f43f5e" };
  }, [clamped]);

  // Semicircle geometry: center (100,100), radius 80, spans 180deg (left) to 0deg (right)
  const cx = 100;
  const cy = 100;
  const r = 80;

  const angleForValue = (v) => Math.PI - (v / 100) * Math.PI; // 180deg -> 0deg
  const pointAt = (v) => {
    const a = angleForValue(v);
    return {
      x: cx + r * Math.cos(a),
      y: cy - r * Math.sin(a),
    };
  };

  const start = pointAt(0);
  const end = pointAt(100);
  const marker = pointAt(clamped);

  const trackPath = `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;

  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 200 118" width="100%" style={{ maxWidth: 230, display: "block", margin: "0 auto" }}>
        <defs>
          <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="50%" stopColor="#e2a13a" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
        </defs>

        {/* background track */}
        <path
          d={trackPath}
          fill="none"
          stroke="#1a2036"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* gradient track */}
        <path
          d={trackPath}
          fill="none"
          stroke="url(#riskGradient)"
          strokeWidth="14"
          strokeLinecap="round"
          opacity="0.9"
        />

        {/* marker */}
        <circle cx={marker.x} cy={marker.y} r="8" fill="#0a0e17" stroke={bucket.color} strokeWidth="4" />

        {/* center readout */}
        <text x={cx} y={cy - 18} textAnchor="middle" fontSize="26" fontWeight="700" fill="#f1f5f9">
          {Math.round(clamped)}%
        </text>
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize="12.5" fontWeight="600" fill={bucket.color}>
          {bucket.label}
        </text>
      </svg>

      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 4, fontSize: 11 }}>
        <span style={{ color: "#8b94ab" }}>
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#34d399", marginRight: 5 }} />
          Safe 0–30
        </span>
        <span style={{ color: "#8b94ab" }}>
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#e2a13a", marginRight: 5 }} />
          Suspicious 31–70
        </span>
        <span style={{ color: "#8b94ab" }}>
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: "#f43f5e", marginRight: 5 }} />
          High Risk 71–100
        </span>
      </div>
    </div>
  );
}
