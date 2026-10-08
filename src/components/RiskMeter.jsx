import { useMemo } from "react";
import "./RiskMeter.css";

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
 *
 * Styling lives in RiskMeter.css. The gauge geometry (cx, cy, path) is
 * calculated here because it depends on `value`.
 */

const LEGEND = [
  { tone: "safe", text: "Safe 0–30" },
  { tone: "suspicious", text: "Suspicious 31–70" },
  { tone: "high", text: "High Risk 71–100" },
];

export default function RiskMeter({ value = 0 }) {
  const clamped = Math.max(0, Math.min(100, value));

  const bucket = useMemo(() => {
    if (clamped <= 30) return { label: "Safe", tone: "safe" };
    if (clamped <= 70) return { label: "Suspicious", tone: "suspicious" };
    return { label: "High Risk", tone: "high" };
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
    <div className={`risk-meter risk-meter--${bucket.tone}`}>
      <svg className="risk-meter__svg" viewBox="0 0 200 118">
        <defs>
          <linearGradient id="riskGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop
              offset="0%"
              className="risk-meter__stop risk-meter__stop--safe"
            />
            <stop
              offset="50%"
              className="risk-meter__stop risk-meter__stop--suspicious"
            />
            <stop
              offset="100%"
              className="risk-meter__stop risk-meter__stop--high"
            />
          </linearGradient>
        </defs>

        {/* background track */}
        <path
          className="risk-meter__track"
          d={trackPath}
          fill="none"
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
        <circle
          className="risk-meter__marker"
          cx={marker.x}
          cy={marker.y}
          r="8"
          strokeWidth="4"
        />

        {/* center readout */}
        <text
          className="risk-meter__value"
          x={cx}
          y={cy - 18}
          textAnchor="middle"
        >
          {Math.round(clamped)}%
        </text>
        <text
          className="risk-meter__label"
          x={cx}
          y={cy + 2}
          textAnchor="middle"
        >
          {bucket.label}
        </text>
      </svg>

      <div className="risk-meter__legend">
        {LEGEND.map((item) => (
          <span key={item.tone} className="risk-meter__legend-item">
            <span className={`risk-meter__dot risk-meter__dot--${item.tone}`} />
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}
