import { useLayout } from "../contexts/LayoutContext";
import LayoutSwitcher from "./LayoutSwitcher";

const NAV_ITEMS = [
  { key: "today", icon: "📊", label: "今日" },
  { key: "report", icon: "📝", label: "日报" },
  { key: "weekly", icon: "📅", label: "周报" },
  { key: "monthly", icon: "🗓️", label: "月报" },
  { key: "history", icon: "📈", label: "历史" },
  { key: "pomodoro", icon: "🍅", label: "番茄" },
];

export default function NavBar() {
  const { currentView, setCurrentView } = useLayout();

  return (
    <nav className="nav-bar">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.key}
          className={`nav-item${currentView === item.key ? " active" : ""}`}
          onClick={() => setCurrentView(item.key)}
        >
          {item.icon} {item.label}
        </button>
      ))}
      <div className="nav-spacer" />
      <button
        className="nav-item"
        onClick={() => setCurrentView("settings")}
        title="设置"
      >
        ⚙
      </button>
      <LayoutSwitcher />
    </nav>
  );
}
