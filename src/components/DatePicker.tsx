import { useEffect, useRef, useState } from "react";

function pad(value: number): string { return value.toString().padStart(2, "0"); }
function dateKey(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

interface Props {
  value: string;
  onChange: (next: string) => void;
}

const WEEK_HEAD = ["一", "二", "三", "四", "五", "六", "日"];

/** new Date("YYYY-MM-DD") 会按 UTC 解析，东八区下变成前一天，
 *  跨月时会让选择器头显示上个月。这里手工拆，和 Weekly/Monthly 保持一致。 */
function parseDate(v: string): Date {
  const parts = v.split("-").map(Number);
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return new Date();
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}

export default function DatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseDate(value));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const monthLabel = `${cursor.getFullYear()} 年 ${pad(cursor.getMonth() + 1)} 月`;
  const firstDayIndex = (() => {
    const day = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
    return (day + 6) % 7;
  })();
  const totalDays = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDayIndex; i++) cells.push(null);
  for (let day = 1; day <= totalDays; day++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
  while (cells.length % 7 !== 0) cells.push(null);

  const today = dateKey(new Date());
  // 未来日期禁用：选到明天只会看到整页 0 分钟，用户会以为数据丢了
  const maxKey = today;

  return (
    <div ref={ref} className="date-picker">
      <button className="date-picker-trigger" onClick={() => setOpen((v) => !v)}>{value}</button>
      {open && (
        <div className="date-picker-pop">
          <div className="date-picker-head">
            <button className="layout-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>◀</button>
            <span>{monthLabel}</span>
            <button className="layout-btn" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>▶</button>
          </div>
          <div className="date-picker-grid">
            {WEEK_HEAD.map((w) => <span key={w} className="date-picker-weekday">{w}</span>)}
            {cells.map((cell, idx) => {
              if (!cell) return <span key={idx} className="date-picker-cell empty" />;
              const key = dateKey(cell);
              const active = key === value;
              const isToday = key === today;
              const future = key > maxKey;
              return (
                <button
                  key={idx}
                  disabled={future}
                  className={`date-picker-cell${active ? " active" : ""}${isToday ? " today" : ""}`}
                  onClick={() => { if (!future) { onChange(key); setOpen(false); } }}
                >
                  {cell.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
