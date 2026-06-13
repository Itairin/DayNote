interface Props {
  score: number;
  size?: number;
}

export default function ScoreRing({ score, size = 160 }: Props) {
  const clamped = Math.max(0, Math.min(100, score));
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;
  const color = clamped >= 80 ? "#30b94e" : clamped >= 50 ? "#ff9f0a" : "#ff453a";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "24px 0 16px",
    }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle fill="none" stroke="#e8e8ed" strokeWidth="8" cx={size/2} cy={size/2} r={r} />
          <circle fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={offset} cx={size/2} cy={size/2} r={r} />
        </svg>
        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: size * 0.23, fontWeight: 700, color: "var(--text)",
        }}>
          {clamped}
        </div>
      </div>
    </div>
  );
}
