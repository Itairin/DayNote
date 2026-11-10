import { createContext, useContext, useState, ReactNode, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

interface ReportSlot {
  kind: "daily" | "weekly" | "monthly" | "draft";
  range: string;
  text: string;
}

interface AppDataContextType {
  loading: boolean;
  error: string | null;
  records: any[];
  summary: any;
  report: string;
  reportSlot: ReportSlot | null;
  draft: string;
  recentDays: any[];
  weeklyUsage: any[];
  monthlyUsage: any[];
  fetchTodayRecords: () => Promise<void>;
  fetchTodaySummary: () => Promise<void>;
  fetchReport: (concise?: boolean) => Promise<void>;
  fetchWeeklyUsage: (startDate: string) => Promise<void>;
  fetchWeeklyReport: (startDate: string, concise?: boolean) => Promise<void>;
  fetchDailyReportForDate: (date: string, concise?: boolean) => Promise<void>;
  fetchMonthlyUsage: (year: number, month: number) => Promise<void>;
  fetchMonthlyReport: (year: number, month: number, concise?: boolean) => Promise<void>;
  fetchDraft: (date?: string) => Promise<void>;
  fetchRecentDays: (days: number) => Promise<void>;
  deleteRecord: (id: number) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

/** 后端所有命令失败时返回的是合法的 {"error":...} JSON，而不是 reject。
 *  以前前端只取 res.records || []，于是数据库出错时界面显示"暂无记录"，
 *  用户会以为数据被清空了。这里统一把 error 抬成异常。 */
function unwrap(raw: string): any {
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === "object" && parsed.error) {
    throw new Error(String(parsed.error));
  }
  return parsed;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [reportSlot, setReportSlot] = useState<ReportSlot | null>(null);
  const [draft, setDraftState] = useState("");
  const [recentDays, setRecentDays] = useState<any[]>([]);
  const [weeklyUsage, setWeeklyUsage] = useState<any[]>([]);
  const [monthlyUsage, setMonthlyUsage] = useState<any[]>([]);

  // 每个请求一个自增序号：快速切换周/月时，只接受最后一次请求的结果，
  // 避免旧响应覆盖新数据（日期条显示第 1 周、数据却是第 4 周）。
  const seq = useRef(0);
  const nextSeq = () => ++seq.current;
  const isLatest = (n: number) => n === seq.current;

  const handleError = (e: any) => {
    setError(typeof e === "string" ? e : e?.message || "未知错误");
  };

  const fetchTodayRecords = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = unwrap(await invoke<string>("get_today_records"));
      setRecords(res.records || []);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchTodaySummary = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = unwrap(await invoke<string>("get_today_summary"));
      setSummary(res);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchReport = useCallback(async (concise = false) => {
    setLoading(true); setError(null);
    const id = nextSeq();
    try {
      const text = await invoke<string>("generate_daily_report", { concise });
      if (!isLatest(id)) return;
      setReportSlot({ kind: "daily", range: new Date().toISOString().slice(0, 10), text });
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchDraft = useCallback(async (date?: string) => {
    setLoading(true); setError(null);
    try {
      const text = await invoke<string>("generate_daily_draft", { date: date ?? null });
      setDraftState(text);
      setReportSlot(null);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchRecentDays = useCallback(async (days: number) => {
    setLoading(true); setError(null);
    try {
      const res = unwrap(await invoke<string>("get_recent_days", { days }));
      setRecentDays(res.days || []);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchWeeklyUsage = useCallback(async (startDate: string) => {
    setLoading(true); setError(null);
    const id = nextSeq();
    try {
      const res = unwrap(await invoke<string>("get_weekly_app_usage", { startDate }));
      if (!isLatest(id)) return;
      setWeeklyUsage(res.days || []);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchWeeklyReport = useCallback(async (startDate: string, concise = false) => {
    setLoading(true); setError(null);
    const id = nextSeq();
    try {
      const text = await invoke<string>("generate_weekly_report", { startDate, concise });
      if (!isLatest(id)) return;
      setReportSlot({ kind: "weekly", range: startDate, text });
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchMonthlyUsage = useCallback(async (year: number, month: number) => {
    setLoading(true); setError(null);
    const id = nextSeq();
    try {
      const res = unwrap(await invoke<string>("get_month_app_usage", { year, month }));
      if (!isLatest(id)) return;
      setMonthlyUsage(res.days || []);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchDailyReportForDate = useCallback(async (date: string, concise = false) => {
    setLoading(true); setError(null);
    const id = nextSeq();
    try {
      const text = await invoke<string>("generate_daily_report_for_date", { date, concise });
      if (!isLatest(id)) return;
      setReportSlot({ kind: "daily", range: date, text });
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchMonthlyReport = useCallback(async (year: number, month: number, concise = false) => {
    setLoading(true); setError(null);
    const id = nextSeq();
    try {
      const text = await invoke<string>("generate_monthly_report", { year, month, concise });
      if (!isLatest(id)) return;
      setReportSlot({ kind: "monthly", range: `${year}-${String(month).padStart(2, "0")}`, text });
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const deleteRecord = useCallback(async (id: number) => {
    try {
      unwrap(await invoke<string>("delete_record", { id }));
      await fetchTodayRecords();
    } catch (e) { handleError(e); }
  }, [fetchTodayRecords]);

  const report = reportSlot?.text ?? "";

  return (
    <AppDataContext.Provider value={{
      loading, error, records, summary, report, reportSlot, draft, recentDays, weeklyUsage, monthlyUsage,
      fetchTodayRecords, fetchTodaySummary, fetchReport, fetchWeeklyUsage, fetchWeeklyReport,
      fetchDailyReportForDate, fetchMonthlyUsage, fetchMonthlyReport, fetchDraft, fetchRecentDays, deleteRecord,
    }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be inside AppDataProvider");
  return ctx;
}
