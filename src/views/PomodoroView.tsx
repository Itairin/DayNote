import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type Phase = "focus" | "short_break" | "long_break";
type Status = "idle" | "running" | "paused";

interface SessionRow { id: number; start_time: string; end_time: string; duration_secs: number; kind: string; status: string; label: string | null; }
interface TodayStats { sessions: SessionRow[]; focus_completed: number; total_focus_secs: number; }

const fmtTime = (secs: number) => {
  const m = Math.max(0, Math.floor(secs / 60));
  const s = Math.max(0, secs % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};
const fmtMinutes = (secs: number) => {
  if (secs < 60) return `${secs}秒`;
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h > 0 ? `${h}小时${m}分` : `${m}分钟`;
};

const PHASE_META: Record<Phase, { label: string; color: string; emoji: string }> = {
  focus: { label: "专注中", color: "var(--accent, #ff5252)", emoji: "🍅" },
  short_break: { label: "短休息", color: "#4caf50", emoji: "☕" },
  long_break: { label: "长休息", color: "#1976d2", emoji: "🌿" },
};

const KEY_FOCUS = "daynote-pomo-focus-min";
const KEY_SHORT = "daynote-pomo-short-min";
const KEY_LONG = "daynote-pomo-long-min";
const KEY_LONG_EVERY = "daynote-pomo-long-every";

export default function PomodoroView() {
  const [focusMin, setFocusMin] = useState<number>(() => parseInt(localStorage.getItem(KEY_FOCUS) || "25", 10) || 25);
  const [shortMin, setShortMin] = useState<number>(() => parseInt(localStorage.getItem(KEY_SHORT) || "5", 10) || 5);
  const [longMin, setLongMin] = useState<number>(() => parseInt(localStorage.getItem(KEY_LONG) || "15", 10) || 15);
  const [longEvery, setLongEvery] = useState<number>(() => parseInt(localStorage.getItem(KEY_LONG_EVERY) || "4", 10) || 4);

  const [phase, setPhase] = useState<Phase>("focus");
  const [status, setStatus] = useState<Status>("idle");
  const [remaining, setRemaining] = useState<number>(focusMin * 60);
  const [label, setLabel] = useState("");
  const [today, setToday] = useState<TodayStats | null>(null);

  const startedAtRef = useRef<Date | null>(null);
  const tickRef = useRef<number | null>(null);

  const phaseDuration = (p: Phase) =>
    p === "focus" ? focusMin * 60 : p === "short_break" ? shortMin * 60 : longMin * 60;

  useEffect(() => { localStorage.setItem(KEY_FOCUS, String(focusMin)); }, [focusMin]);
  useEffect(() => { localStorage.setItem(KEY_SHORT, String(shortMin)); }, [shortMin]);
  useEffect(() => { localStorage.setItem(KEY_LONG, String(longMin)); }, [longMin]);
  useEffect(() => { localStorage.setItem(KEY_LONG_EVERY, String(longEvery)); }, [longEvery]);

  useEffect(() => {
    if (status === "idle") setRemaining(phaseDuration(phase));
  }, [focusMin, shortMin, longMin, phase, status]);

  const refreshToday = async () => {
    try {
      const raw = await invoke<string>("pomodoro_get_today");
      const parsed = JSON.parse(raw) as TodayStats;
      setToday(parsed);
    } catch {}
  };

  useEffect(() => { refreshToday(); }, []);

  const tick = () => {
    setRemaining((r) => {
      if (r <= 1) {
        completeSession(true);
        return 0;
      }
      return r - 1;
    });
  };

  const start = () => {
    if (status === "running") return;
    if (status === "idle") {
      startedAtRef.current = new Date();
    }
    setStatus("running");
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(tick, 1000) as unknown as number;
  };

  const pause = () => {
    if (status !== "running") return;
    setStatus("paused");
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
  };

  const reset = () => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    if (status !== "idle" && phase === "focus" && startedAtRef.current) {
      const end = new Date();
      const duration = Math.max(0, Math.floor((end.getTime() - startedAtRef.current.getTime()) / 1000));
      if (duration >= 30) {
        invoke("pomodoro_save_session", {
          startTime: startedAtRef.current.toISOString().slice(0, 19),
          endTime: end.toISOString().slice(0, 19),
          durationSecs: duration,
          kind: "focus",
          status: "cancelled",
          label: label || null,
        }).then(refreshToday).catch(() => undefined);
      }
    }
    setStatus("idle");
    startedAtRef.current = null;
    setRemaining(phaseDuration(phase));
  };
  const completeSession = async (auto: boolean) => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    const end = new Date();
    const start = startedAtRef.current ?? new Date(end.getTime() - phaseDuration(phase) * 1000);
    const duration = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000));

    try {
      await invoke("pomodoro_save_session", {
        startTime: start.toISOString().slice(0, 19),
        endTime: end.toISOString().slice(0, 19),
        durationSecs: duration,
        kind: phase,
        status: auto ? "completed" : "cancelled",
        label: label || null,
      });
    } catch {}
    await refreshToday();

    if (auto && "Notification" in window) {
      try {
        if (Notification.permission === "granted") {
          new Notification(`${PHASE_META[phase].emoji} ${phase === "focus" ? "专注完成" : "休息结束"}`, {
            body: phase === "focus" ? "完成一个番茄，准备休息一下" : "回到工作状态吧",
          });
        }
      } catch {}
    }

    // 自动切换到下一个阶段
    if (phase === "focus") {
      const completedFocus = (today?.focus_completed ?? 0) + 1;
      const next: Phase = completedFocus % longEvery === 0 ? "long_break" : "short_break";
      setPhase(next);
      setRemaining(phaseDuration(next));
    } else {
      setPhase("focus");
      setRemaining(phaseDuration("focus"));
    }
    setStatus("idle");
    startedAtRef.current = null;
  };

  const skip = () => {
    if (tickRef.current) { window.clearInterval(tickRef.current); tickRef.current = null; }
    if (phase === "focus") {
      setPhase("short_break");
      setRemaining(phaseDuration("short_break"));
    } else {
      setPhase("focus");
      setRemaining(phaseDuration("focus"));
    }
    setStatus("idle");
    startedAtRef.current = null;
  };

  const switchPhase = (p: Phase) => {
    if (status !== "idle") return;
    setPhase(p);
    setRemaining(phaseDuration(p));
  };

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
  }, []);

  // 圆环
  const SIZE = 240;
  const STROKE = 14;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const total = phaseDuration(phase);
  const progress = total > 0 ? remaining / total : 0;
  const meta = PHASE_META[phase];

  const recentFocus = (today?.sessions || []).filter((s) => s.kind === "focus" && s.status === "completed").slice(-8);

  return (
    <div className="settings-panel">
      <div className="view-header"><h2>🍅 番茄钟</h2><p>专注一个番茄，做点正经事</p></div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
        {(["focus", "short_break", "long_break"] as Phase[]).map((p) => (
          <button key={p}
            className={"nav-item" + (phase === p ? " active" : "")}
            disabled={status !== "idle"}
            onClick={() => switchPhase(p)}>
            {PHASE_META[p].emoji} {PHASE_META[p].label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center", margin: "8px 0 24px" }}>
        <div style={{ position: "relative", width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE}>
            <circle cx={SIZE/2} cy={SIZE/2} r={R} stroke="var(--border-light)" strokeWidth={STROKE} fill="none" />
            <circle cx={SIZE/2} cy={SIZE/2} r={R}
              stroke={meta.color} strokeWidth={STROKE} fill="none"
              strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
              strokeLinecap="round"
              transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
              style={{ transition: "stroke-dashoffset 0.5s linear" }} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>{meta.emoji} {meta.label}</div>
            <div style={{ fontSize: 56, fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: 0 }}>{fmtTime(remaining)}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              {status === "running" ? "运行中" : status === "paused" ? "已暂停" : "待开始"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
        {status !== "running" && (
          <button className="nav-item active" onClick={start} style={{ minWidth: 90 }}>▶ 开始</button>
        )}
        {status === "running" && (
          <button className="nav-item" onClick={pause} style={{ minWidth: 90 }}>⏸ 暂停</button>
        )}
        <button className="nav-item" onClick={reset} style={{ minWidth: 90 }}>⏹ 停止</button>
        <button className="nav-item" onClick={skip} style={{ minWidth: 90 }} title="跳过当前阶段">⏭ 跳过</button>
      </div>

      <div className="settings-section">
        <div className="settings-row">
          <label>专注标签</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="例如: 写日报 / 看论文（可选）"
            style={{ flex: 1, marginLeft: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, background: "var(--surface)", color: "var(--text)", outline: "none" }}
          />
        </div>
      </div>

      <div className="settings-section">
        <h3>今日</h3>
        <div className="settings-row">
          <label>已完成番茄</label>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{today?.focus_completed ?? 0} 个 · {fmtMinutes(today?.total_focus_secs ?? 0)}</div>
        </div>
        {recentFocus.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {recentFocus.map((s) => (
              <span key={s.id} title={`${s.start_time} · ${fmtMinutes(s.duration_secs)}${s.label ? " · " + s.label : ""}`} style={{ fontSize: 18 }}>🍅</span>
            ))}
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>设置</h3>
        <div className="settings-row">
          <label>专注 (分钟)</label>
          <input type="number" min={1} max={180} value={focusMin} disabled={status !== "idle"}
            onChange={(e) => setFocusMin(Math.max(1, parseInt(e.target.value || "25", 10)))}
            style={{ width: 80, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, background: "var(--surface)", color: "var(--text)", outline: "none" }} />
        </div>
        <div className="settings-row">
          <label>短休息 (分钟)</label>
          <input type="number" min={1} max={60} value={shortMin} disabled={status !== "idle"}
            onChange={(e) => setShortMin(Math.max(1, parseInt(e.target.value || "5", 10)))}
            style={{ width: 80, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, background: "var(--surface)", color: "var(--text)", outline: "none" }} />
        </div>
        <div className="settings-row">
          <label>长休息 (分钟)</label>
          <input type="number" min={1} max={120} value={longMin} disabled={status !== "idle"}
            onChange={(e) => setLongMin(Math.max(1, parseInt(e.target.value || "15", 10)))}
            style={{ width: 80, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, background: "var(--surface)", color: "var(--text)", outline: "none" }} />
        </div>
        <div className="settings-row">
          <label>每几个番茄长休息</label>
          <input type="number" min={2} max={12} value={longEvery} disabled={status !== "idle"}
            onChange={(e) => setLongEvery(Math.max(2, parseInt(e.target.value || "4", 10)))}
            style={{ width: 80, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, background: "var(--surface)", color: "var(--text)", outline: "none" }} />
        </div>
      </div>
    </div>
  );
}