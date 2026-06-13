import React, { useEffect, useState } from "react";
import { useAppData } from "../contexts/AppData";
import DatePicker from "../components/DatePicker";

const WD = ["日", "一", "二", "三", "四", "五", "六"];

function pad(v: number) { return v.toString().padStart(2, "0"); }
function dateKey(d: Date) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parseDate(v: string): Date {
  const parts = v.split("-").map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}
function startOfWeek(d: Date) {
  const n = new Date(d); n.setDate(n.getDate() - n.getDay()); n.setHours(0, 0, 0, 0); return n;
}
function fmtDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? h + "小时" + m + "分钟" : m + "分钟";
}

export default function WeeklyView() {
  const { weeklyUsage, report, loading, fetchWeeklyUsage, fetchWeeklyReport, fetchDailyReportForDate } = useAppData();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [showReport, setShowReport] = useState(false);
  
  const [showPopup, setShowPopup] = useState(false);
  const [popupMode, setPopupMode] = useState("weekly");

  const startDate = dateKey(weekStart);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart); d.setDate(d.getDate() + i); return d; });
  const selectedData = weeklyUsage.find((item: any) => item.date === selectedDate);

  useEffect(() => { fetchWeeklyUsage(startDate); }, [fetchWeeklyUsage, startDate]);

  const moveWeek = (offset: number) => {
    const next = new Date(weekStart); next.setDate(next.getDate() + offset);
    setWeekStart(next); setSelectedDate(dateKey(next)); setShowReport(false);
  };

  const jumpTo = (value: string) => {
    const target = parseDate(value);
    setWeekStart(startOfWeek(target)); setSelectedDate(value); setShowReport(false);
  };

  const generateWeekly = () => { setPopupMode("weekly"); setShowPopup(true); };
  const generateDaily = () => { setPopupMode("daily"); setShowPopup(true); };

  const doGenerate = async (concise: boolean) => {
    setShowPopup(false);
    if (popupMode === "weekly") {
      await fetchWeeklyReport(startDate, concise);
    } else {
      await fetchDailyReportForDate(selectedDate, concise);
    }
    setShowReport(true);
    
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(report); } catch {}
  };

  return React.createElement("div", null,
    React.createElement("div", { className: "view-header" },
      React.createElement("h2", null, "\uD83D\uDCC5 周报"),
      React.createElement("p", null, "选择日期查看当天应用使用情况")
    ),
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" } },
      React.createElement("button", { className: "layout-btn", onClick: () => moveWeek(-7) }, "\u25C0"),
      React.createElement(DatePicker, { value: startDate, onChange: jumpTo }),
      React.createElement("button", { className: "layout-btn", onClick: () => moveWeek(7) }, "\u25B6"),
      React.createElement("div", { className: "nav-spacer" }),
      React.createElement("button", { className: "copy-btn", style: { height: 32 }, onClick: generateWeekly }, "\uD83D\uDCCA 生成周报"),
      React.createElement("button", { className: "copy-btn", style: { height: 32 }, onClick: generateDaily }, "\uD83D\uDCCB 生成日报")
    ),
    React.createElement("div", { className: "weekly-date-strip" },
      ...days.map((day) => {
        const key = dateKey(day);
        const data = weeklyUsage.find((item: any) => item.date === key);
        return React.createElement("button", {
          key, className: "weekly-date-card" + (selectedDate === key ? " active" : ""),
          onClick: () => { setSelectedDate(key); setShowReport(false); }
        },
          React.createElement("span", null, "周" + WD[day.getDay()]),
          React.createElement("strong", null, day.getDate()),
          React.createElement("em", null, fmtDuration(data?.total_secs || 0))
        );
      })
    ),
    React.createElement("div", { className: "weekly-selected-panel" },
      React.createElement("div", { className: "weekly-selected-head" },
        React.createElement("h3", null, selectedDate),
        React.createElement("span", null, fmtDuration(selectedData?.total_secs || 0))
      ),
      React.createElement("div", { className: "weekly-app-list selected" },
        ...((selectedData?.apps || []).map((app: any) =>
          React.createElement("div", { key: app.app_name, className: "weekly-app-row" },
            React.createElement("span", null, app.app_name),
            React.createElement("b", null, fmtDuration(app.duration_secs || 0))
          )
        )),
        !selectedData ? React.createElement("div", { className: "weekly-empty" }, "暂无记录") : null
      )
    ),
    loading ? React.createElement("div", { className: "empty-state" }, React.createElement("p", null, "正在加载")) : null,
    showReport && report ? React.createElement("div", { style: { marginTop: 20 } },
      React.createElement("div", { className: "report-preview" }, report),
      React.createElement("button", { className: "copy-btn", style: { height: 32 }, onClick: handleCopy }, "\uD83D\uDCCB 复制" + (popupMode === "weekly" ? "周报" : "日报"))
    ) : null,
    showPopup ? React.createElement("div", { className: "popup-overlay", onClick: () => setShowPopup(false) },
      React.createElement("div", { className: "popup-card", onClick: (e: any) => e.stopPropagation() },
        React.createElement("div", { className: "popup-title" }, popupMode === "weekly" ? "选择周报模式" : "选择日报模式"),
        React.createElement("div", { className: "popup-actions" },
          React.createElement("button", { className: "copy-btn", style: { height: 32 }, onClick: () => doGenerate(false) }, "明细版"),
          React.createElement("button", { className: "copy-btn", style: { height: 32 }, onClick: () => doGenerate(true) }, "简明版")
        )
      )
    ) : null
  );
}
