import React, { useEffect, useMemo, useState } from "react";
import { useAppData } from "../contexts/AppData";
import DatePicker from "../components/DatePicker";

const WD = ["一", "二", "三", "四", "五", "六", "日"];

function pad(v: number) { return v.toString().padStart(2, "0"); }
function dateKey(d: Date) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parseDate(v: string): Date {
  const parts = v.split("-").map(Number);
  return new Date(parts[0], (parts[1] || 1) - 1, parts[2] || 1);
}
function fmtDuration(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return h > 0 ? h + "小时" + m + "分钟" : m + "分钟";
}

export default function MonthlyView() {
  const { monthlyUsage, report, loading, fetchMonthlyUsage, fetchMonthlyReport, fetchDailyReportForDate } = useAppData();
  const [cursor, setCursor] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [showReport, setShowReport] = useState(false);
  
  const [showPopup, setShowPopup] = useState(false);
  const [popupMode, setPopupMode] = useState("monthly");

  const year = cursor.getFullYear();
  const month = cursor.getMonth() + 1;
  const monthStart = year + "-" + pad(month) + "-01";
  const monthEndDay = new Date(year, month, 0).getDate();

  useEffect(() => { fetchMonthlyUsage(year, month); }, [fetchMonthlyUsage, year, month]);

  const cells = useMemo(() => {
    const firstWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const items: Array<{ key: string; date: Date | null; data?: any } | null> = [];
    for (let i = 0; i < firstWeekday; i++) items.push(null);
    for (let day = 1; day <= monthEndDay; day++) {
      const date = new Date(year, month - 1, day);
      const key = dateKey(date);
      const data = monthlyUsage.find((item: any) => item.date === key);
      items.push({ key, date, data });
    }
    while (items.length % 7 !== 0) items.push(null);
    return items;
  }, [year, month, monthEndDay, monthlyUsage]);

  const selectedData = monthlyUsage.find((item: any) => item.date === selectedDate);
  const monthTotal = monthlyUsage.reduce((sum: number, day: any) => sum + (day.total_secs || 0), 0);

  const moveMonth = (offset: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    setCursor(next); setSelectedDate(dateKey(next)); setShowReport(false);
  };

  const jumpTo = (value: string) => {
    const target = parseDate(value);
    setCursor(new Date(target.getFullYear(), target.getMonth(), 1));
    setSelectedDate(value); setShowReport(false);
  };

  const generateMonthly = () => { setPopupMode("monthly"); setShowPopup(true); };
  const generateDaily = () => { setPopupMode("daily"); setShowPopup(true); };

  const doGenerate = async (concise: boolean) => {
    setShowPopup(false);
    if (popupMode === "monthly") {
      await fetchMonthlyReport(year, month, concise);
    } else {
      await fetchDailyReportForDate(selectedDate, concise);
    }
    setShowReport(true);
    
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(report); } catch {}
  };

  const totalForColor = Math.max(monthTotal / monthEndDay, 1);

  return React.createElement("div", null,
    React.createElement("div", { className: "view-header" },
      React.createElement("h2", null, "\uD83D\uDDD3\uFE0F 月报"),
      React.createElement("p", null, "整月活动分布与单日明细")
    ),
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" } },
      React.createElement("button", { className: "layout-btn", onClick: () => moveMonth(-1) }, "\u25C0"),
      React.createElement(DatePicker, { value: monthStart, onChange: jumpTo }),
      React.createElement("button", { className: "layout-btn", onClick: () => moveMonth(1) }, "\u25B6"),
      React.createElement("div", { className: "nav-spacer" }),
      React.createElement("span", { style: { fontSize: 13, color: "var(--text-secondary)" } }, "本月合计 " + fmtDuration(monthTotal)),
      React.createElement("button", { className: "copy-btn", style: { height: 32 }, onClick: generateMonthly }, "\uD83D\uDCCA 生成月报"),
      React.createElement("button", { className: "copy-btn", style: { height: 32 }, onClick: generateDaily }, "\uD83D\uDCCB 生成日报")
    ),
    React.createElement("div", { className: "month-grid" },
      ...WD.map((w) => React.createElement("span", { key: w, className: "month-weekday" }, "周" + w)),
      ...cells.map((cell, idx) => {
        if (!cell) return React.createElement("span", { key: idx, className: "month-cell empty" });
        const active = cell.key === selectedDate;
        const secs = cell.data?.total_secs || 0;
        const intensity = Math.min(1, secs / (totalForColor * 1.6));
        return React.createElement("button", {
          key: cell.key,
          className: "month-cell" + (active ? " active" : "") + (secs > 0 ? " has-data" : ""),
          onClick: () => { setSelectedDate(cell.key); setShowReport(false); },
          style: secs > 0 ? { background: "color-mix(in srgb, var(--accent) " + Math.round(intensity * 80) + "%, transparent)" } : undefined
        },
          React.createElement("strong", null, cell.date?.getDate()),
          React.createElement("em", null, secs > 0 ? fmtDuration(secs) : "\u2014")
        );
      })
    ),
    React.createElement("div", { className: "weekly-selected-panel", style: { marginTop: 16 } },
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
      React.createElement("button", { className: "copy-btn", style: { height: 32 }, onClick: handleCopy }, "\uD83D\uDCCB 复制" + (popupMode === "monthly" ? "月报" : "日报"))
    ) : null,
    showPopup ? React.createElement("div", { className: "popup-overlay", onClick: () => setShowPopup(false) },
      React.createElement("div", { className: "popup-card", onClick: (e: any) => e.stopPropagation() },
        React.createElement("div", { className: "popup-title" }, popupMode === "monthly" ? "选择月报模式" : "选择日报模式"),
        React.createElement("div", { className: "popup-actions" },
          React.createElement("button", { className: "copy-btn", style: { height: 32 }, onClick: () => doGenerate(false) }, "明细版"),
          React.createElement("button", { className: "copy-btn", style: { height: 32 }, onClick: () => doGenerate(true) }, "简明版")
        )
      )
    ) : null
  );
}
