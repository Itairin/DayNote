import { useEffect, useState } from "react";
import { useAppData } from "../contexts/AppData";

export default function ReportView() {
  const { report, loading, fetchReport } = useAppData();
  const [mode, setMode] = useState<"detail" | "concise">("detail");

  useEffect(() => { fetchReport(mode === "concise"); }, [fetchReport, mode]);
  const handleCopy = async () => { try { await navigator.clipboard.writeText(report); } catch {} };

  if (loading) return (
    <div><div className="skeleton" style={{ width: 160, height: 24, marginBottom: 16 }} /><div className="skeleton" style={{ width: "100%", height: 300 }} /></div>
  );

  return (
    <div>
      <div className="view-header"><h2>📝 日报预览</h2><p>今日活动总结，可复制到剪贴板</p></div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button className={"nav-item" + (mode === "detail" ? " active" : "")} onClick={() => setMode("detail")}>明细版</button>
        <button className={"nav-item" + (mode === "concise" ? " active" : "")} onClick={() => setMode("concise")}>简明版</button>
      </div>
      <div className="report-preview">{report || "# 暂无数据"}</div>
      <button className="copy-btn" onClick={handleCopy}>📋 复制到剪贴板</button>
    </div>
  );
}
