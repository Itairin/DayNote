import { useEffect, useState, useCallback } from "react";
import { useAppData } from "../contexts/AppData";
import { invoke } from "@tauri-apps/api/core";

const fmtMinutes = (secs: number) => {
  if (!secs || secs < 60) return `${secs || 0} 秒`;
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h > 0 ? `${h} 小时 ${m} 分` : `${m} 分钟`;
};

interface AppItem { app_name: string; duration_secs: number; }

export default function HistoryView() {
  const { recentDays, loading, fetchRecentDays } = useAppData();
  const [days, setDays] = useState(30);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dayApps, setDayApps] = useState<Record<string, AppItem[]>>({});
  const [dayLoading, setDayLoading] = useState<Record<string, boolean>>({});

  useEffect(() => { fetchRecentDays(days); }, [days, fetchRecentDays]);

  const loadDayUsage = useCallback(async (date: string) => {
    if (dayApps[date]) return;
    setDayLoading((prev) => ({ ...prev, [date]: true }));
    try {
      const raw = await invoke<string>("get_weekly_app_usage", { startDate: date });
      const parsed = JSON.parse(raw);
      const found = (parsed.days || []).find((d: any) => d.date === date);
      const apps: AppItem[] = (found?.apps || []).map((a: any) => ({
        app_name: a.app_name, duration_secs: a.duration_secs,
      }));
      apps.sort((a, b) => b.duration_secs - a.duration_secs);
      setDayApps((prev) => ({ ...prev, [date]: apps }));
    } catch {
      setDayApps((prev) => ({ ...prev, [date]: [] }));
    }
    setDayLoading((prev) => ({ ...prev, [date]: false }));
  }, [dayApps]);

  const toggleDay = (date: string) => {
    if (expanded === date) {
      setExpanded(null);
    } else {
      setExpanded(date);
      loadDayUsage(date);
    }
  };

  return (
    <div>
      <div className="view-header"><h2>📈 历史记录</h2><p>过往活动数据，点击日期查看当日详情</p></div>
      <div style={{ marginBottom: 16, display: "flex", gap: 8 }}>
        {[7, 14, 30, 90].map((n) => (
          <button key={n} className={"nav-item" + (days === n ? " active" : "")} onClick={() => setDays(n)}>
            最近 {n} 天
          </button>
        ))}
      </div>
      {loading && recentDays.length === 0 ? <div className="skeleton" style={{ width: "100%", height: 200 }} />
       : recentDays.length === 0 ? <div className="empty-state"><div className="icon">📊</div><p>暂无历史数据</p></div>
       : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...recentDays].reverse().map((d: any) => {
            const date = d.date as string;
            const isOpen = expanded === date;
            const apps = dayApps[date];
            const isDayLoading = !!dayLoading[date];
            const totalSecs = d.total_secs || 0;
            const topApp = apps && apps.length > 0 ? apps[0] : null;
            const maxSecs = apps && apps.length > 0 ? apps[0].duration_secs : 1;

            return (
              <div key={date} style={{ background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                <button
                  onClick={() => toggleDay(date)}
                  style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 16px", background: "transparent", border: "none", color: "var(--text)",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", width: 12, display: "inline-block", transition: "transform 0.18s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{date}</span>
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{fmtMinutes(totalSecs)}</span>
                </button>
                {isOpen && (
                  <div style={{ padding: "4px 16px 14px 36px", borderTop: "1px solid var(--border-light)" }}>
                    {isDayLoading ? (
                      <div style={{ padding: "12px 0", color: "var(--text-muted)", fontSize: 13 }}>加载中...</div>
                    ) : !apps || apps.length === 0 ? (
                      <div style={{ padding: "12px 0", color: "var(--text-muted)", fontSize: 13 }}>暂无应用记录</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 10 }}>
                        {topApp && (
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
                            <span>共 {apps.length} 个应用</span>
                            <span>主要使用: {topApp.app_name}</span>
                          </div>
                        )}
                        {apps.map((a, idx) => {
                          const pct = maxSecs > 0 ? Math.max(2, (a.duration_secs / maxSecs) * 100) : 0;
                          return (
                            <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                              <span style={{ flex: "0 0 36%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.app_name}</span>
                              <div style={{ flex: 1, height: 6, background: "var(--border-light)", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent, #3b82f6)", borderRadius: 3 }} />
                              </div>
                              <span style={{ flex: "0 0 80px", textAlign: "right", color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{fmtMinutes(a.duration_secs)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}
