import { useLayout } from "../contexts/LayoutContext";
import LayoutSwitcher from "./LayoutSwitcher";

const ITEMS = [
  { key: "today", icon: "📊", label: "今日" },
  { key: "report", icon: "📝", label: "日报" },
  { key: "weekly", icon: "📅", label: "周报" },
  { key: "monthly", icon: "🗓️", label: "月报" },
  { key: "history", icon: "📈", label: "历史" },
  { key: "pomodoro", icon: "🍅", label: "番茄" },
];

export default function Sidebar() {
  const { currentView, setCurrentView } = useLayout();

  return (
    <div className="sidebar">
      {ITEMS.map((item) => (
        <button key={item.key} className={"sidebar-item" + (currentView === item.key ? " active" : "")}
          onClick={() => setCurrentView(item.key)} title={item.label}>
          {item.icon}
        </button>
      ))}
      <div className="sidebar-spacer" />
      <button className="sidebar-item" title="设置" onClick={() => setCurrentView("settings")}>⚙</button>
      <LayoutSwitcher />
    </div>
  );
}
