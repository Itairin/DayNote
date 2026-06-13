import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";

type LayoutMode = "minimal" | "dashboard";
type NavPosition = "top" | "sidebar";
type CloseBehavior = "tray" | "exit";

interface LayoutContextType {
  mode: LayoutMode;
  setMode: (mode: LayoutMode) => void;
  navPosition: NavPosition;
  setNavPosition: (pos: NavPosition) => void;
  currentView: string;
  setCurrentView: (view: string) => void;
  closeBehavior: CloseBehavior;
  setCloseBehavior: (behavior: CloseBehavior) => void;
  retentionDays: number;
  setRetentionDays: (days: number) => void;
  privacyRules: string[];
  setPrivacyRules: (rules: string[]) => void;
  autoStart: boolean;
  setAutoStart: (enabled: boolean) => void;
  exportDir: string;
  setExportDir: (dir: string) => void;
  exportDirIsCustom: boolean;
}

const LayoutContext = createContext<LayoutContextType | null>(null);
const KEY_MODE = "daynote-layout-mode";
const KEY_NAV = "daynote-layout-nav";
const KEY_VIEW = "daynote-view";
const KEY_CLOSE = "daynote-close-behavior";
const KEY_RETENTION = "daynote-retention-days";
const KEY_PRIVACY = "daynote-privacy-rules";
const KEY_AUTOSTART = "daynote-autostart";
const KEY_EXPORT_DIR = "daynote-export-dir";

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<LayoutMode>(() =>
    (localStorage.getItem(KEY_MODE) as LayoutMode) || "minimal"
  );
  const [navPosition, setNavPos] = useState<NavPosition>(() =>
    (localStorage.getItem(KEY_NAV) as NavPosition) || "top"
  );
  const [currentView, setView] = useState(() =>
    localStorage.getItem(KEY_VIEW) || "today"
  );
  const [closeBehavior, setCloseBehaviorState] = useState<CloseBehavior>(() =>
    (localStorage.getItem(KEY_CLOSE) as CloseBehavior) || "tray"
  );
  const [retentionDays, setRetentionDaysState] = useState<number>(() => {
    const stored = parseInt(localStorage.getItem(KEY_RETENTION) || "", 10);
    return Number.isFinite(stored) && stored > 0 ? stored : 30;
  });
  const [privacyRules, setPrivacyRulesState] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(KEY_PRIVACY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((v: unknown) => typeof v === "string" && v.trim() !== "") : [];
    } catch {
      return [];
    }
  });
  const [autoStart, setAutoStartState] = useState<boolean>(() => localStorage.getItem(KEY_AUTOSTART) === "1");
  const [exportDir, setExportDirState] = useState<string>(() => localStorage.getItem(KEY_EXPORT_DIR) || "");
  const [exportDirIsCustom, setExportDirIsCustomState] = useState<boolean>(() => !!localStorage.getItem(KEY_EXPORT_DIR));

  const setMode = (m: LayoutMode) => { setModeState(m); localStorage.setItem(KEY_MODE, m); };
  const setNavPosition = (p: NavPosition) => { setNavPos(p); localStorage.setItem(KEY_NAV, p); };
  const setCurrentView = (v: string) => { setView(v); localStorage.setItem(KEY_VIEW, v); };
  const setCloseBehavior = (b: CloseBehavior) => { setCloseBehaviorState(b); localStorage.setItem(KEY_CLOSE, b); };
  const setRetentionDays = (days: number) => {
    setRetentionDaysState(days);
    localStorage.setItem(KEY_RETENTION, String(days));
  };
  const setPrivacyRules = (rules: string[]) => {
    const cleaned = Array.from(new Set(rules.map((r) => r.trim()).filter((r) => r.length > 0)));
    setPrivacyRulesState(cleaned);
    localStorage.setItem(KEY_PRIVACY, JSON.stringify(cleaned));
  };
  const setAutoStart = (enabled: boolean) => {
    setAutoStartState(enabled);
    localStorage.setItem(KEY_AUTOSTART, enabled ? "1" : "0");
  };
  const setExportDir = (dir: string) => {
    const cleaned = dir.trim();
    invoke<string>("set_export_dir", { dir: cleaned || null }).then((raw) => {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.dir) {
          setExportDirState(parsed.dir);
          setExportDirIsCustomState(!!parsed.custom);
          if (parsed.custom) {
            localStorage.setItem(KEY_EXPORT_DIR, cleaned);
          } else {
            localStorage.removeItem(KEY_EXPORT_DIR);
          }
        }
      } catch {}
    }).catch(() => undefined);
  };

  useEffect(() => {
    invoke("set_close_to_tray", { enabled: closeBehavior === "tray" }).catch(() => undefined);
  }, [closeBehavior]);

  useEffect(() => {
    invoke("cleanup_old_records", { retentionDays }).catch(() => undefined);
  }, [retentionDays]);

  useEffect(() => {
    invoke("set_privacy_rules", { rules: privacyRules }).catch(() => undefined);
  }, [privacyRules]);

  useEffect(() => {
    invoke("set_autostart", { enabled: autoStart }).catch(() => undefined);
  }, [autoStart]);

  useEffect(() => {
    invoke<string>("get_autostart").then((raw) => {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.enabled === "boolean") {
          setAutoStartState(parsed.enabled);
          localStorage.setItem(KEY_AUTOSTART, parsed.enabled ? "1" : "0");
        }
      } catch {}
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(KEY_EXPORT_DIR);
    if (stored && stored.trim().length > 0) {
      invoke<string>("set_export_dir", { dir: stored }).then((raw) => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.dir) {
            setExportDirState(parsed.dir);
            setExportDirIsCustomState(!!parsed.custom);
          }
        } catch {}
      }).catch(() => undefined);
    } else {
      invoke<string>("get_export_dir").then((raw) => {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.dir) {
            setExportDirState(parsed.dir);
            setExportDirIsCustomState(!!parsed.custom);
          }
        } catch {}
      }).catch(() => undefined);
    }
  }, []);

  return (
    <LayoutContext.Provider value={{ mode, setMode, navPosition, setNavPosition, currentView, setCurrentView, closeBehavior, setCloseBehavior, retentionDays, setRetentionDays, privacyRules, setPrivacyRules, autoStart, setAutoStart, exportDir, setExportDir, exportDirIsCustom }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const ctx = useContext(LayoutContext);
  if (!ctx) throw new Error("useLayout must be inside LayoutProvider");
  return ctx;
}
