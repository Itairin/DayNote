interface Props {
  label: string;
  value: string | number;
  unit?: string;
}

export default function StatCard({ label, value, unit }: Props) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div>
        <span className="stat-value">{value}</span>
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
    </div>
  );
}
