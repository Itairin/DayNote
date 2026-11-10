import { useEffect, useState } from "react";
import { useAppData } from "../contexts/AppData";

type Mode = "draft" | "detail" | "concise";

export default function ReportView() {
  const { report, draft, loading, fetchReport, fetchDraft } = useAppData();
  const [mode, setMode] = useState<Mode>("draft");
  const [copied, setCopied] = useState<"" | "ok" | "fail">("");

  useEffect(() => {
    if (mode === "draft") fetchDraft();
    else fetchReport(mode === "concise");
  }, [mode, fetchDraft, fetchReport]);

  // 草稿是可编辑的：用户在这里改完再复制。
  // 之前只有一个只读的 Markdown 预览，又没有渲染器，用户看到的是裸 # 和坏围栏。
  const [edited, setEdited] = useState("");
  useEffect(() => { setEdited(draft); }, [draft]);

  const text = mode === "draft" ? edited : report;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    setTimeout(() => setCopied(""), 2000);
  };

  if (loading && !text) return (
    <div><div className="skeleton" style={{ width: 160, height: 24, marginBottom: 16 }} /><div className="skeleton" style={{ width: "100%", height: 300 }} /></div>
  );

  return (
    <div>
      <div className="view-header">
        <h2>📝 日报</h2>
        <p>生成草稿 → 直接改 → 复制到工作群</p>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        <button className={"nav-item" + (mode === "draft" ? " active" : "")} onClick={() => setMode("draft")}>草稿（可编辑）</button>
        <button className={"nav-item" + (mode === "detail" ? " active" : "")} onClick={() => setMode("detail")}>明细版</button>
        <button className={"nav-item" + (mode === "concise" ? " active" : "")} onClick={() => setMode("concise")}>简明版</button>
      </div>

      {mode === "draft" ? (
        <textarea
          className="report-editor"
          value={edited}
          onChange={(e) => setEdited(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <div className="report-preview">{report || "# 暂无数据"}</div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="copy-btn" onClick={handleCopy}>
          📋 {mode === "draft" ? "复制草稿" : "复制报告"}
        </button>
        {copied === "ok" && <span className="copy-hint ok">已复制到剪贴板</span>}
        {copied === "fail" && <span className="copy-hint fail">复制失败，请手动选中文本复制</span>}
      </div>
    </div>
  );
}
