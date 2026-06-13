import { useEffect } from "react";
import { useAppData } from "../contexts/AppData";
import { useLayout } from "../contexts/LayoutContext";
import ScoreRing from "../components/ScoreRing";
import StatCard from "../components/StatCard";
import Timeline from "../components/Timeline";

export default function TodayView() {
  const { records, summary, loading, fetchTodayRecords, fetchTodaySummary } = useAppData();
  const { mode } = useLayout();

  useEffect(() => { fetchTodayRecords(); fetchTodaySummary(); }, [fetchTodayRecords, fetchTodaySummary]);

  if (loading && records.length === 0) return (
    <div><div className="skeleton" style={{ width: 200, height: 24, marginBottom: 16 }} /><div className="skeleton" style={{ width: "100%", height: 200 }} /></div>
  );

  const totalSecs = summary?.total_focus_secs || 0;
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const longestSecs = records.reduce((max: number, record: any) => Math.max(max, record.duration_secs || 0), 0);
  const longestMins = Math.floor(longestSecs / 60);

  const uniqueWindows = new Set(records.map((r: any) => r.window_title)).size;
  const minimalStatCards = (
    <div className="stats-row">
      <StatCard label="今日专注" value={hours} unit={`小时 ${mins}分钟`} />
      <StatCard label="活动窗口" value={uniqueWindows} unit="个" />
      <StatCard label="最长停留" value={longestMins} unit="分钟" />
    </div>
  );
  const dashboardStatCards = (
    <div className="stats-row">
      <StatCard label="今日专注" value={hours} unit={`小时 ${mins}分钟`} />
      <StatCard label="活动窗口" value={uniqueWindows} unit="个" />
      <StatCard label="效率评分" value={summary?.efficiency_score ?? "—"} unit="分" />
    </div>
  );

  if (mode === "minimal") {
    return (
      <div className="today-view minimal-today">
        <div className="minimal-hero">
          <ScoreRing score={summary?.efficiency_score ?? 85} />
          {minimalStatCards}
        </div>
      </div>
    );
  }

  return (
    <div className="today-view dashboard-today">
      {dashboardStatCards}
      <Timeline items={records} />
    </div>
  );
}
