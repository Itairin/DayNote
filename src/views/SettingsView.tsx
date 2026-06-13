import { useEffect, useState } from "react";
import { useLayout } from "../contexts/LayoutContext";
import { invoke } from "@tauri-apps/api/core";
import { open as shellOpen } from "@tauri-apps/plugin-shell";
import logoUrl from "../assets/logo.png";
import githubIcon from "../assets/github.png";
import ifdianIcon from "../assets/ifdian.png";

export default function SettingsView() {
  const { mode, setMode, navPosition, setNavPosition, closeBehavior, setCloseBehavior, retentionDays, setRetentionDays, privacyRules, setPrivacyRules, autoStart, setAutoStart, exportDir, setExportDir, exportDirIsCustom } = useLayout();
  const [input, setInput] = useState("");
  const [exportMsg, setExportMsg] = useState("");
  const [exporting, setExporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importing, setImporting] = useState(false);
  const [dirInput, setDirInput] = useState(exportDir);
  const [dirEditing, setDirEditing] = useState(false);

const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [notifyTime, setNotifyTime] = useState("22:00");
  const [backupEnabled, setBackupEnabledState] = useState(true);
  const [backupLast, setBackupLast] = useState("");
  const [backupPath, setBackupPath] = useState("");
  const [backupMsg, setBackupMsg] = useState("");

  useEffect(() => {
    invoke<string>("get_notification_settings").then((raw) => {
      try {
        const v = JSON.parse(raw);
        if (typeof v?.enabled === "boolean") setNotifyEnabled(v.enabled);
        if (typeof v?.time === "string" && /^\d{2}:\d{2}$/.test(v.time)) setNotifyTime(v.time);
      } catch {}
    }).catch(() => undefined);
    invoke<string>("get_backup_status").then((raw) => {
      try {
        const v = JSON.parse(raw);
        if (typeof v?.enabled === "boolean") setBackupEnabledState(v.enabled);
        if (typeof v?.last === "string") setBackupLast(v.last);
        if (typeof v?.path === "string") setBackupPath(v.path);
      } catch {}
    }).catch(() => undefined);
  }, []);

  const applyNotify = (enabled: boolean, time: string) => {
    setNotifyEnabled(enabled);
    setNotifyTime(time);
    invoke("set_notification_settings", { enabled, time }).catch(() => undefined);
  };

  const applyBackupEnabled = (enabled: boolean) => {
    setBackupEnabledState(enabled);
    invoke("set_backup_settings", { enabled }).catch(() => undefined);
  };

  const runBackup = async () => {
    setBackupMsg("");
    try {
      const raw = await invoke<string>("run_backup_now");
      const v = JSON.parse(raw);
      if (v.path) {
        setBackupPath(v.path);
        setBackupLast(new Date().toLocaleString());
        setBackupMsg("备份成功: " + v.path);
      } else if (v.error) {
        setBackupMsg("备份失败: " + v.error);
      }
    } catch (e) {
      setBackupMsg("备份失败");
    }
    setTimeout(() => setBackupMsg(""), 6000);
  };


  const applyRetention = (days: number) => {
    setRetentionDays(days);
    invoke("cleanup_old_records", { retentionDays: days }).catch(() => undefined);
  };

  const addRule = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setPrivacyRules([...privacyRules, trimmed]);
    setInput("");
  };

  const removeRule = (idx: number) => {
    setPrivacyRules(privacyRules.filter((_, i) => i !== idx));
  };

  const handleExport = async (format: string) => {
    setExporting(true);
    setExportMsg("");
    try {
      const raw = await invoke<string>("export_all_data", { format });
      const parsed = JSON.parse(raw);
      if (parsed.path) {
        setExportMsg("导出成功: " + parsed.path);
      } else if (parsed.error) {
        setExportMsg("导出失败: " + parsed.error);
      }
    } catch (e) {
      setExportMsg("导出失败");
    }
    setExporting(false);
    setTimeout(() => setExportMsg(""), 6000);
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportMsg("");
    try {
      const text = await file.text();
      const lower = file.name.toLowerCase();
      const format = lower.endsWith(".csv") ? "csv" : lower.endsWith(".json") ? "json" : null;
      const raw = await invoke<string>("import_data", { content: text, format });
      const parsed = JSON.parse(raw);
      if (parsed.error) {
        setImportMsg("导入失败: " + parsed.error);
      } else {
        setImportMsg(`导入完成: 新增 ${parsed.inserted}，跳过 ${parsed.skipped}，失败 ${parsed.failed}（共 ${parsed.total}）`);
      }
    } catch (e) {
      setImportMsg("导入失败: " + String(e));
    }
    setImporting(false);
    setTimeout(() => setImportMsg(""), 8000);
  };

  const applyExportDir = () => {
    setExportDir(dirInput.trim());
    setDirEditing(false);
  };

  const resetExportDir = () => {
    setExportDir("");
    setDirInput("");
    setDirEditing(false);
  };
  return (
    <div className="settings-panel">
      <div className="view-header"><h2>设置</h2><p>应用偏好配置</p></div>

      <div className="settings-section">
        <h3>显示</h3>
        <div className="settings-row">
          <label>布局模式</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["minimal", "dashboard"] as const).map((m) => (
              <button key={m} className={"nav-item" + (mode === m ? " active" : "")} onClick={() => setMode(m)}>
                {m === "minimal" ? "极简" : "详细"}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <label>导航位置</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["top", "sidebar"] as const).map((p) => (
              <button key={p} className={"nav-item" + (navPosition === p ? " active" : "")} onClick={() => setNavPosition(p)}>
                {p === "top" ? "顶栏" : "侧栏"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>启动</h3>
        <div className="settings-row">
          <div>
            <label>开机自启</label>
            <div className="desc">系统登录时自动运行 Daynote</div>
          </div>
          <button
            className={"nav-item" + (autoStart ? " active" : "")}
            onClick={() => setAutoStart(!autoStart)}
            style={{ minWidth: 56 }}
          >
            {autoStart ? "开" : "关"}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>数据</h3>
        <div className="settings-row">
          <div>
            <label>数据保留</label>
            <div className="desc">超过的旧记录会被自动清理</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[30, 60, 90, 180].map((n) => (
              <button key={n} className={"nav-item" + (retentionDays === n ? " active" : "")} onClick={() => applyRetention(n)}>
                {n} 天
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div>
            <label>立即清理</label>
            <div className="desc">按当前保留天数立刻清理旧记录</div>
          </div>
          <button className="nav-item" onClick={() => applyRetention(retentionDays)}>清理</button>
        </div>        <div className="settings-row">
          <div>
            <label>导出全部数据</label>
            <div className="desc" style={{ wordBreak: "break-all" }}>
              {exportDir
                ? (exportDirIsCustom ? "自定义目录: " : "默认目录: ") + exportDir
                : "将所有活动记录导出到系统下载目录"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button className="nav-item" disabled={exporting} onClick={() => handleExport("json")}>JSON</button>
            <button className="nav-item" disabled={exporting} onClick={() => handleExport("csv")}>CSV</button>
            <button className="nav-item" onClick={() => { setDirInput(exportDir); setDirEditing(!dirEditing); }}>
              {dirEditing ? "收起" : "更改目录"}
            </button>
          </div>
        </div>
        {dirEditing && (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <input
              value={dirInput}
              onChange={(e) => setDirInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyExportDir()}
              placeholder="例: D:\Daynote导出  (留空恢复默认下载目录)"
              style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, background: "var(--surface)", color: "var(--text)", outline: "none" }}
            />
            <button className="nav-item" onClick={applyExportDir}>保存</button>
            <button className="nav-item" onClick={resetExportDir}>恢复默认</button>
          </div>
        )}
        {exportMsg && (
          <div style={{ marginTop: 6, fontSize: 12, color: exportMsg.indexOf("失败") >= 0 ? "var(--danger)" : "var(--accent, #4caf50)", wordBreak: "break-all" }}>
            {exportMsg}
          </div>
        )}
        <div className="settings-row">
          <div>
            <label>导入数据</label>
            <div className="desc">从 JSON 或 CSV 文件合并到本地数据库，重复记录会自动跳过</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <label className={"nav-item" + (importing ? " disabled" : "")} style={{ cursor: importing ? "not-allowed" : "pointer", opacity: importing ? 0.6 : 1 }}>
              {importing ? "导入中..." : "选择文件"}
              <input
                type="file"
                accept=".json,.csv,application/json,text/csv"
                disabled={importing}
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImport(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        {importMsg && (
          <div style={{ marginTop: 6, fontSize: 12, color: importMsg.indexOf("失败") >= 0 ? "var(--danger)" : "var(--accent, #4caf50)", wordBreak: "break-all" }}>
            {importMsg}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>隐私</h3>
        <div className="settings-row">
          <div>
            <label>隐私过滤</label>
            <div className="desc">匹配的应用将不会被记录。支持应用名或进程名关键词</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRule()}
            placeholder="输入应用名，如 微信、Steam"
            style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, background: "var(--surface)", color: "var(--text)", outline: "none" }}
          />
          <button className="nav-item" onClick={addRule}>添加</button>
        </div>
        {privacyRules.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {privacyRules.map((rule, idx) => (
              <div key={idx} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "var(--surface)", border: "1px solid var(--border-light)", borderRadius: 8, fontSize: 13 }}>
                <span>{rule}</span>
                <button className="nav-item" onClick={() => removeRule(idx)} style={{ color: "var(--danger)", padding: "2px 8px" }}>删除</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>通知</h3>
        <div className="settings-row">
          <div>
            <label>每日通知</label>
            <div className="desc">到点提醒今日小结，可点击通知或托盘打开 Daynote</div>
          </div>
          <button
            className={"nav-item" + (notifyEnabled ? " active" : "")}
            onClick={() => applyNotify(!notifyEnabled, notifyTime)}
            style={{ minWidth: 56 }}
          >
            {notifyEnabled ? "开" : "关"}
          </button>
        </div>
        <div className="settings-row">
          <div>
            <label>通知时间</label>
            <div className="desc">格式 HH:MM，例如 22:00</div>
          </div>
          <input
            type="time"
            value={notifyTime}
            onChange={(e) => applyNotify(notifyEnabled, e.target.value || "22:00")}
            disabled={!notifyEnabled}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, background: "var(--surface)", color: "var(--text)", outline: "none" }}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>备份</h3>
        <div className="settings-row">
          <div>
            <label>每日自动备份</label>
            <div className="desc">每天将数据库副本写入导出目录的 backups 子目录，保留 60 天</div>
          </div>
          <button
            className={"nav-item" + (backupEnabled ? " active" : "")}
            onClick={() => applyBackupEnabled(!backupEnabled)}
            style={{ minWidth: 56 }}
          >
            {backupEnabled ? "开" : "关"}
          </button>
        </div>
        <div className="settings-row">
          <div>
            <label>立即备份</label>
            <div className="desc" style={{ wordBreak: "break-all" }}>
              {backupLast ? `最近一次: ${backupLast}` : "还没有备份过"}
              {backupPath ? ` · ${backupPath}` : ""}
            </div>
          </div>
          <button className="nav-item" onClick={runBackup}>备份</button>
        </div>
        {backupMsg && (
          <div style={{ marginTop: 6, fontSize: 12, color: backupMsg.indexOf("失败") >= 0 ? "var(--danger)" : "var(--accent, #4caf50)", wordBreak: "break-all" }}>
            {backupMsg}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>窗口</h3>
        <div className="settings-row">
          <div>
            <label>关闭按钮</label>
            <div className="desc">控制点击窗口右上角关闭时的行为</div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["tray", "exit"] as const).map((behavior) => (
              <button key={behavior} className={"nav-item" + (closeBehavior === behavior ? " active" : "")} onClick={() => setCloseBehavior(behavior)}>
                {behavior === "tray" ? "缩小到托盘" : "直接关闭"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>关于</h3>
        <div className="settings-row about-header">
          <img src={logoUrl} alt="Daynote" className="about-logo" />
          <div>
            <label>Daynote</label>
            <div className="desc">v1.0.0 · 自动日报 by Itair</div>
          </div>
        </div>
        <div className="settings-row">
          <div>
            <label>赞助</label>
            <div className="desc">如果 Daynote 帮到你，可以请作者喝杯咖啡</div>
          </div>
          <button className="nav-item link-btn" onClick={() => shellOpen("https://www.ifdian.net/a/itair").catch(() => undefined)}>
            <img src={ifdianIcon} alt="" className="link-btn-icon" />爱发电
          </button>
        </div>
        <div className="settings-row">
          <div>
            <label>个人主页</label>
            <div className="desc">作者的 GitHub 主页</div>
          </div>
          <button className="nav-item link-btn" onClick={() => shellOpen("https://github.com/Itairin").catch(() => undefined)}>
            <img src={githubIcon} alt="" className="link-btn-icon" />GitHub
          </button>
        </div>
      </div>
    </div>
  );
}