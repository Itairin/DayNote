import { ReactNode } from "react";
import { useLayout } from "../contexts/LayoutContext";

const ITEMS = [
  { key: "today", icon: "📊", label: "今日" },
  { key: "report", icon: "📝", label: "日报" },
  { key: "weekly", icon: "📅", label: "周报" },
  { key: "history", icon: "📈", label: "历史" },
];

export default function LayoutSidebar({ children }: { children: ReactNode }) {
  const { currentView, setCurrentView } = useLayout();

  return (
    <div className="sidebar-layout">
      <div className="sidebar">
        {ITEMS.map((item) => (
          <button key={item.key} className={`sidebar-item${currentView === item.key ? " active" : ""}`}
            onClick={() => setCurrentView(item.key)} title={item.label}>
            {item.icon}
          </button>
        ))}
        <div className="sidebar-spacer" />
        <button className="sidebar-item" title="设置" onClick={() => setCurrentView("settings")}>⚙</button>
      </div>
      <div className="sidebar-content">
        <NavBarInline />
        <div className="content-area">{children}</div>
      </div>
    </div>
  );
}

function NavBarInline() {
  const { currentView, setCurrentView } = useLayout();
  return (
    <nav className="nav-bar">
      {ITEMS.map((item) => (
        <button key={item.key} className={`nav-item${currentView === item.key ? " active" : ""}`}
          onClick={() => setCurrentView(item.key)}>
          {item.label}
        </button>
      ))}
      <div className="nav-spacer" />
    </nav>
  );
}
