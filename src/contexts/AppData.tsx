import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";

interface AppDataContextType {
  loading: boolean;
  error: string | null;
  records: any[];
  summary: any;
  report: string;
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
  fetchRecentDays: (days: number) => Promise<void>;
  deleteRecord: (id: number) => Promise<void>;
}

const AppDataContext = createContext<AppDataContextType | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [report, setReport] = useState("");
  const [recentDays, setRecentDays] = useState<any[]>([]);
  const [weeklyUsage, setWeeklyUsage] = useState<any[]>([]);
  const [monthlyUsage, setMonthlyUsage] = useState<any[]>([]);

  const handleError = (e: any) => {
    setError(typeof e === "string" ? e : e?.message || "Unknown error");
    setLoading(false);
  };

  const fetchTodayRecords = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = JSON.parse(await invoke("get_today_records"));
      setRecords(res.records || []);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchTodaySummary = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = JSON.parse(await invoke("get_today_summary"));
      setSummary(res);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchReport = useCallback(async (concise = false) => {
    setLoading(true); setError(null);
    try {
      setReport(await invoke("generate_daily_report", { concise }) as string);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchRecentDays = useCallback(async (days: number) => {
    setLoading(true); setError(null);
    try {
      const res = JSON.parse(await invoke("get_recent_days", { days }));
      setRecentDays(res.days || []);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchWeeklyUsage = useCallback(async (startDate: string) => {
    setLoading(true); setError(null);
    try {
      const res = JSON.parse(await invoke("get_weekly_app_usage", { startDate }));
      setWeeklyUsage(res.days || []);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchWeeklyReport = useCallback(async (startDate: string, concise = false) => {
    setLoading(true); setError(null);
    try {
      setReport(await invoke("generate_weekly_report", { startDate, concise }) as string);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchMonthlyUsage = useCallback(async (year: number, month: number) => {
    setLoading(true); setError(null);
    try {
      const res = JSON.parse(await invoke("get_month_app_usage", { year, month }));
      setMonthlyUsage(res.days || []);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);
  const fetchDailyReportForDate = useCallback(async (date: string, concise = false) => {
    setLoading(true); setError(null);
    try {
      setReport(await invoke("generate_daily_report_for_date", { date, concise }) as string);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const fetchMonthlyReport = useCallback(async (year: number, month: number, concise = false) => {
    setLoading(true); setError(null);
    try {
      setReport(await invoke("generate_monthly_report", { year, month, concise }) as string);
    } catch (e) { handleError(e); }
    setLoading(false);
  }, []);

  const deleteRecord = useCallback(async (id: number) => {
    try {
      await invoke("delete_record", { id });
      await fetchTodayRecords();
    } catch (e) { handleError(e); }
  }, [fetchTodayRecords]);

  return (
    <AppDataContext.Provider value={{
      loading, error, records, summary, report, recentDays, weeklyUsage, monthlyUsage,
      fetchTodayRecords, fetchTodaySummary, fetchReport, fetchWeeklyUsage, fetchWeeklyReport, fetchDailyReportForDate, fetchMonthlyUsage, fetchMonthlyReport, fetchRecentDays, deleteRecord,
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
