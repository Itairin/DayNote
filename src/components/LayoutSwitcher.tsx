import { useState } from "react";
import { useLayout } from "../contexts/LayoutContext";

const MODES = [
  { key: "minimal" as const, icon: "🌱", label: "极简" },
  { key: "dashboard" as const, icon: "📊", label: "详细" },
];

export default function LayoutSwitcher() {
  const { mode, setMode } = useLayout();
  const [open, setOpen] = useState(false);
  const current = MODES.find((m) => m.key === mode);

  return (
    <div className="layout-switcher">
      <button className="layout-btn" onClick={() => setOpen(!open)} title="切换布局">
        {current?.icon || "🌱"}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div className="layout-dropdown">
            {MODES.map((m) => (
              <button key={m.key} className={"layout-dropdown-item" + (mode === m.key ? " active" : "")}
                onClick={() => { setMode(m.key); setOpen(false); }}>
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
