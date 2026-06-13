import { useEffect, useRef, useState } from "react";

function pad(value: number): string { return value.toString().padStart(2, "0"); }
function dateKey(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

interface Props {
  value: string;
  onChange: (next: string) => void;
}

const WEEK_HEAD = ["一", "二", "三", "四", "五", "六", "日"];

export default function DatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  });
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
              return (
                <button
                  key={idx}
                  className={`date-picker-cell${active ? " active" : ""}${isToday ? " today" : ""}`}
                  onClick={() => { onChange(key); setOpen(false); }}
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
