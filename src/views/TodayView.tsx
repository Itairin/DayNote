import { useEffect } from "react";
import { useAppData } from "../contexts/AppData";
import { useLayout } from "../contexts/LayoutContext";
import ScoreRing from "../components/ScoreRing";
import StatCard from "../components/StatCard";
import Timeline from "../components/Timeline";

function fmtTotal(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return { h, m };
}

export default function TodayView() {
  const { records, summary, error, loading, fetchTodayRecords, fetchTodaySummary, deleteRecord } = useAppData();
  const { mode } = useLayout();

  // 数据不再只拉一次：切回窗口、页面重新可见、以及每 60 秒都刷新一次。
  // 之前盯着"0 小时"看十分钟也不变，用户会以为没在记录。
  useEffect(() => {
    fetchTodayRecords();
    fetchTodaySummary();
    const timer = window.setInterval(() => {
      fetchTodayRecords();
      fetchTodaySummary();
    }, 60000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        fetchTodayRecords();
        fetchTodaySummary();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [fetchTodayRecords, fetchTodaySummary]);

  if (error) return (
    <div className="empty-state">
      <div className="icon">⚠️</div>
      <p>读取数据失败：{error}</p>
      <button className="nav-item" style={{ marginTop: 12 }} onClick={() => { fetchTodayRecords(); fetchTodaySummary(); }}>重试</button>
    </div>
  );

  if (loading && records.length === 0) return (
    <div><div className="skeleton" style={{ width: 200, height: 24, marginBottom: 16 }} /><div className="skeleton" style={{ width: "100%", height: 200 }} /></div>
  );

  const totalSecs = summary?.total_activity_secs ?? summary?.total_focus_secs ?? 0;
  const { h: hours, m: mins } = fmtTotal(totalSecs);
  const longestSecs = records.reduce((max: number, record: any) => Math.max(max, record.duration_secs || 0), 0);
  const longestMins = Math.floor(longestSecs / 60);
  const uniqueWindows = new Set(records.map((r: any) => r.window_title)).size;

  // 评分可能是 null（数据不足）。以前这里用 ?? 85 兜底，等于凭空编了一个 85 分，
  // 而同一屏的 StatCard 却显示"—"，自相矛盾。
  const score: number | null = typeof summary?.efficiency_score === "number" ? summary.efficiency_score : null;

  const productiveMins = Math.floor((summary?.productive_secs ?? 0) / 60);
  const entertainmentMins = Math.floor((summary?.entertainment_secs ?? 0) / 60);

  const minimalStatCards = (
    <div className="stats-row">
      <StatCard label="记录时长" value={hours} unit={`小时 ${mins}分钟`} />
      <StatCard label="有效工作" value={productiveMins} unit="分钟" />
      <StatCard label="活动窗口" value={uniqueWindows} unit="个" />
    </div>
  );
  const dashboardStatCards = (
    <div className="stats-row">
      <StatCard label="记录时长" value={hours} unit={`小时 ${mins}分钟`} />
      <StatCard label="有效工作" value={productiveMins} unit="分钟" />
      <StatCard label="娱乐" value={entertainmentMins} unit="分钟" />
      <StatCard label="最长停留" value={longestMins} unit="分钟" />
    </div>
  );

  if (mode === "minimal") {
    return (
      <div className="today-view minimal-today">
        <div className="minimal-hero">
          {score !== null
            ? <ScoreRing score={score} />
            : <div className="score-empty">今天还没有足够数据评分</div>}
          {minimalStatCards}
        </div>
      </div>
    );
  }

  return (
    <div className="today-view dashboard-today">
      {dashboardStatCards}
      <Timeline items={records} onDelete={deleteRecord} />
    </div>
  );
}
