import { useEffect } from "react";
import { LayoutProvider, useLayout } from "./contexts/LayoutContext";
import { AppDataProvider, useAppData } from "./contexts/AppData";
import LayoutWrapper from "./layouts/LayoutWrapper";
import TodayView from "./views/TodayView";
import ReportView from "./views/ReportView";
import WeeklyView from "./views/WeeklyView";
import MonthlyView from "./views/MonthlyView";
import HistoryView from "./views/HistoryView";
import PomodoroView from "./views/PomodoroView";
import SettingsView from "./views/SettingsView";
import "./App.css";

function AppContent() {
  const { currentView } = useLayout();
  const { error } = useAppData();

  const renderView = () => {
    switch (currentView) {
      case "today": return <TodayView />;
      case "report": return <ReportView />;
      case "weekly": return <WeeklyView />;
      case "monthly": return <MonthlyView />;
      case "history": return <HistoryView />;
      case "pomodoro": return <PomodoroView />;
      case "settings": return <SettingsView />;
      default: return <TodayView />;
    }
  };

  return (
    <LayoutWrapper>
      {error && (
        <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 999,
          background: "var(--danger)", color: "#fff", padding: "8px 16px", borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}
      {renderView()}
    </LayoutWrapper>
  );
}

export default function App() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = (e: any) => {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    };
    update(mq);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <LayoutProvider>
      <AppDataProvider>
        <AppContent />
      </AppDataProvider>
    </LayoutProvider>
  );
}
