mod db;
mod monitor;
mod report;
mod icon;

use std::sync::Mutex;
use tauri::{Emitter, Manager, State};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

pub(crate) struct AppState {
    db: Mutex<db::Database>,
}

pub(crate) struct PreferenceState {
    close_to_tray: Mutex<bool>,
    pub(crate) privacy_rules: Mutex<Vec<String>>,
    export_dir: Mutex<Option<String>>,
    notify_enabled: Mutex<bool>,
    notify_time: Mutex<String>,
    backup_enabled: Mutex<bool>,
    backup_last: Mutex<String>,
    backup_last_path: Mutex<String>,
}

#[tauri::command]
fn get_today_records(state: State<'_, AppState>) -> String {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    match state.db.lock().unwrap().get_records_by_date(&today) {
        Ok(records) => serde_json::json!({"records": records}).to_string(),
        Err(e) => serde_json::json!({"error": e.to_string()}).to_string(),
    }
}

#[tauri::command]
fn get_today_summary(state: State<'_, AppState>) -> String {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    match state.db.lock().unwrap().get_summary_by_date(&today) {
        Ok(v) => {
            let mut s = v;
            let total = s["total_focus_secs"].as_i64().unwrap_or(0);
            let score = if total > 0 { (((total as f64) / (8.0 * 3600.0) * 100.0).round() as i32).min(100) } else { 0 };
            s["efficiency_score"] = serde_json::json!(score);
            s.to_string()
        }
        Err(e) => serde_json::json!({"error": e.to_string()}).to_string(),
    }
}

#[tauri::command]
fn generate_daily_report(concise: Option<bool>, state: State<'_, AppState>) -> String {
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let db = state.db.lock().unwrap();
    match db.get_records_by_date(&today) {
        Ok(ref records) => report::ReportGenerator::generate_daily_report(records, concise.unwrap_or(false)),
        Err(_) => String::from("# 今日总结\n\n暂无数据"),
    }
}

#[tauri::command]
fn generate_daily_report_for_date(date: String, concise: Option<bool>, state: State<'_, AppState>) -> String {
    let db = state.db.lock().unwrap();
    match db.get_records_by_date(&date) {
        Ok(ref records) => report::ReportGenerator::generate_daily_report(records, concise.unwrap_or(false)),
        Err(_) => format!("# 今日总结 {}\n\n暂无数据", date),
    }
}

#[tauri::command]
fn get_weekly_app_usage(start_date: String, state: State<'_, AppState>) -> String {
    match state.db.lock().unwrap().get_weekly_app_usage(&start_date) {
        Ok(days) => serde_json::json!({"days": days}).to_string(),
        Err(e) => serde_json::json!({"error": e.to_string()}).to_string(),
    }
}

#[tauri::command]
fn get_month_app_usage(year: i32, month: u32, state: State<'_, AppState>) -> String {
    match state.db.lock().unwrap().get_month_app_usage(year, month) {
        Ok(days) => serde_json::json!({"days": days}).to_string(),
        Err(e) => serde_json::json!({"error": e.to_string()}).to_string(),
    }
}

#[tauri::command]
fn generate_monthly_report(year: i32, month: u32, concise: Option<bool>, state: State<'_, AppState>) -> String {
    let db = state.db.lock().unwrap();
    match db.get_month_app_usage(year, month) {
        Ok(ref days) => report::ReportGenerator::generate_monthly_report(year, month, days, concise.unwrap_or(false)),
        Err(_) => format!("# 月报 {:04}-{:02}\n\n暂无数据", year, month),
    }
}

#[tauri::command]
fn cleanup_old_records(retention_days: i64, state: State<'_, AppState>) -> String {
    match state.db.lock().unwrap().delete_older_than(retention_days) {
        Ok(removed) => serde_json::json!({"removed": removed}).to_string(),
        Err(e) => serde_json::json!({"error": e.to_string()}).to_string(),
    }
}

#[tauri::command]
fn generate_weekly_report(start_date: String, concise: Option<bool>, state: State<'_, AppState>) -> String {
    let db = state.db.lock().unwrap();
    match db.get_weekly_app_usage(&start_date) {
        Ok(ref days) => report::ReportGenerator::generate_weekly_report(&start_date, days, concise.unwrap_or(false)),
        Err(_) => format!("# 周报 {} 起\n\n暂无数据", start_date),
    }
}

#[tauri::command]
fn get_recent_days(days: i32, state: State<'_, AppState>) -> String {
    match state.db.lock().unwrap().get_recent_days(days as i64) {
        Ok(days_data) => serde_json::json!({"days": days_data}).to_string(),
        Err(e) => serde_json::json!({"error": e.to_string()}).to_string(),
    }
}

#[tauri::command]
fn delete_record(id: i32, state: State<'_, AppState>) -> String {
    match state.db.lock().unwrap().delete_record(id as i64) {
        Ok(_) => serde_json::json!({"deleted": id}).to_string(),
        Err(e) => serde_json::json!({"error": e.to_string()}).to_string(),
    }
}

#[tauri::command]
fn set_close_to_tray(enabled: bool, state: State<'_, PreferenceState>) -> String {
    *state.close_to_tray.lock().unwrap() = enabled;
    serde_json::json!({ "close_to_tray": enabled }).to_string()
}

#[tauri::command]
fn set_privacy_rules(rules: Vec<String>, state: State<'_, PreferenceState>) -> String {
    if let Ok(mut guard) = state.privacy_rules.lock() {
        *guard = rules
            .into_iter()
            .map(|rule| rule.trim().to_string())
            .filter(|rule| !rule.is_empty())
            .collect();
        serde_json::json!({ "count": guard.len() }).to_string()
    } else {
        serde_json::json!({ "error": "lock" }).to_string()
    }
}


#[tauri::command]
fn set_autostart(enabled: bool, app: tauri::AppHandle) -> String {
    let manager = app.autolaunch();
    let result = if enabled {
        manager.enable()
    } else {
        manager.disable()
    };
    match result {
        Ok(_) => serde_json::json!({"ok": true, "enabled": enabled}).to_string(),
        Err(e) => serde_json::json!({"error": e.to_string()}).to_string(),
    }
}

#[tauri::command]
fn get_autostart(app: tauri::AppHandle) -> String {
    match app.autolaunch().is_enabled() {
        Ok(enabled) => serde_json::json!({"enabled": enabled}).to_string(),
        Err(e) => serde_json::json!({"error": e.to_string()}).to_string(),
    }
}

#[tauri::command]
fn export_all_data(format: String, state: State<'_, AppState>, pref: State<'_, PreferenceState>) -> String {
    let records = match state.db.lock().unwrap().get_all_records() {
        Ok(r) => r,
        Err(e) => return serde_json::json!({"error": e.to_string()}).to_string(),
    };
    let stamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let fmt = format.to_lowercase();
    let (filename, payload) = if fmt == "csv" {
        let mut buf = String::from("id,date,start_time,end_time,duration_secs,process_name,window_title\n");
        for r in &records {
            let esc = |v: &str| -> String {
                if v.contains(',') || v.contains('"') || v.contains('\n') {
                    let escaped = v.replace('"', "\"\"");
                    format!("\"{}\"", escaped)
                } else {
                    v.to_string()
                }
            };
            let id = r.get("id").and_then(|x| x.as_i64()).unwrap_or(0);
            let date = r.get("date").and_then(|x| x.as_str()).unwrap_or("");
            let st = r.get("start_time").and_then(|x| x.as_str()).unwrap_or("");
            let et = r.get("end_time").and_then(|x| x.as_str()).unwrap_or("");
            let dur = r.get("duration_secs").and_then(|x| x.as_i64()).unwrap_or(0);
            let pn = r.get("process_name").and_then(|x| x.as_str()).unwrap_or("");
            let wt = r.get("window_title").and_then(|x| x.as_str()).unwrap_or("");
            buf.push_str(&format!(
                "{},{},{},{},{},{},{}\n",
                id, esc(date), esc(st), esc(et), dur, esc(pn), esc(wt)
            ));
        }
        (format!("daynote_export_{}.csv", stamp), buf)
    } else {
        let json = serde_json::json!({
            "exported_at": chrono::Local::now().to_rfc3339(),
            "count": records.len(),
            "records": records,
        });
        (
            format!("daynote_export_{}.json", stamp),
            serde_json::to_string_pretty(&json).unwrap_or_else(|_| "{}".into()),
        )
    };

    let custom_dir = pref.export_dir.lock().ok().and_then(|g| g.clone());
    let dir = custom_dir
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|| dirs::download_dir().or_else(dirs::home_dir).unwrap_or_else(|| std::path::PathBuf::from(".")));
    if let Err(e) = std::fs::create_dir_all(&dir) {
        return serde_json::json!({"error": format!("无法创建导出目录: {}", e)}).to_string();
    }
    let target = dir.join(&filename);
    if let Err(e) = std::fs::write(&target, payload.as_bytes()) {
        return serde_json::json!({"error": e.to_string()}).to_string();
    }
    serde_json::json!({
        "ok": true,
        "path": target.to_string_lossy(),
        "count": records.len(),
        "format": fmt,
    })
    .to_string()
}

#[tauri::command]
fn set_export_dir(dir: Option<String>, state: State<'_, PreferenceState>) -> String {
    let cleaned = dir.and_then(|d| {
        let trimmed = d.trim().to_string();
        if trimmed.is_empty() { None } else { Some(trimmed) }
    });
    if let Some(ref d) = cleaned {
        if let Err(e) = std::fs::create_dir_all(d) {
            return serde_json::json!({"error": format!("无法创建目录: {}", e)}).to_string();
        }
    }
    if let Ok(mut guard) = state.export_dir.lock() {
        *guard = cleaned.clone();
    }
    let effective = cleaned
        .clone()
        .unwrap_or_else(|| {
            dirs::download_dir()
                .or_else(dirs::home_dir)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default()
        });
    serde_json::json!({"ok": true, "dir": effective, "custom": cleaned.is_some()}).to_string()
}

#[tauri::command]
fn get_export_dir(state: State<'_, PreferenceState>) -> String {
    let custom = state.export_dir.lock().ok().and_then(|g| g.clone());
    let effective = custom.clone().unwrap_or_else(|| {
        dirs::download_dir()
            .or_else(dirs::home_dir)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default()
    });
    serde_json::json!({"dir": effective, "custom": custom.is_some()}).to_string()
}

#[tauri::command]
fn import_data(content: String, format: Option<String>, state: State<'_, AppState>) -> String {
    let db = state.db.lock().unwrap();
    let trimmed = content.trim_start();
    let fmt = format
        .map(|f| f.to_lowercase())
        .filter(|f| f == "json" || f == "csv")
        .unwrap_or_else(|| {
            if trimmed.starts_with('{') || trimmed.starts_with('[') {
                "json".to_string()
            } else {
                "csv".to_string()
            }
        });

    let mut records: Vec<(String, String, String, String, i64, String)> = Vec::new();
    if fmt == "json" {
        let parsed: serde_json::Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(e) => return serde_json::json!({"error": format!("JSON 解析失败: {}", e)}).to_string(),
        };
        let arr = if parsed.is_array() {
            parsed.as_array().cloned().unwrap_or_default()
        } else if let Some(arr) = parsed.get("records").and_then(|v| v.as_array()) {
            arr.clone()
        } else {
            return serde_json::json!({"error": "JSON 中找不到 records 数组"}).to_string();
        };
        for item in arr {
            let wt = item.get("window_title").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let pn = item.get("process_name").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let st = item.get("start_time").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let et = item.get("end_time").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let dur = item.get("duration_secs").and_then(|v| v.as_i64()).unwrap_or(0);
            let date = item.get("date").and_then(|v| v.as_str()).unwrap_or("").to_string();
            if st.is_empty() || date.is_empty() {
                continue;
            }
            records.push((wt, pn, st, et, dur, date));
        }
    } else {
        let parsed = parse_csv(&content);
        if parsed.is_empty() {
            return serde_json::json!({"error": "CSV 为空或缺少表头"}).to_string();
        }
        let header = &parsed[0];
        let find = |name: &str| header.iter().position(|h| h.trim().eq_ignore_ascii_case(name));
        let i_wt = find("window_title");
        let i_pn = find("process_name");
        let i_st = find("start_time");
        let i_et = find("end_time");
        let i_dur = find("duration_secs");
        let i_date = find("date");
        if i_st.is_none() || i_date.is_none() {
            return serde_json::json!({"error": "CSV 缺少必要列 (start_time, date)"}).to_string();
        }
        for row in parsed.iter().skip(1) {
            let get = |idx: Option<usize>| -> String {
                idx.and_then(|i| row.get(i)).cloned().unwrap_or_default()
            };
            let wt = get(i_wt);
            let pn = get(i_pn);
            let st = get(i_st);
            let et = get(i_et);
            let dur = get(i_dur).parse::<i64>().unwrap_or(0);
            let date = get(i_date);
            if st.is_empty() || date.is_empty() {
                continue;
            }
            records.push((wt, pn, st, et, dur, date));
        }
    }

    let mut inserted = 0usize;
    let mut skipped = 0usize;
    let mut failed = 0usize;
    for (wt, pn, st, et, dur, date) in records.iter() {
        match db.record_exists(st, pn, wt) {
            Ok(true) => { skipped += 1; continue; }
            Ok(false) => {}
            Err(_) => { failed += 1; continue; }
        }
        match db.insert_record(wt, pn, st, et, *dur, date) {
            Ok(_) => inserted += 1,
            Err(_) => failed += 1,
        }
    }

    serde_json::json!({
        "ok": true,
        "format": fmt,
        "total": records.len(),
        "inserted": inserted,
        "skipped": skipped,
        "failed": failed,
    }).to_string()
}

fn parse_csv(text: &str) -> Vec<Vec<String>> {
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut cur_row: Vec<String> = Vec::new();
    let mut cur_field = String::new();
    let mut in_quotes = false;
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if in_quotes {
            if c == '"' {
                if chars.peek() == Some(&'"') {
                    cur_field.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            } else {
                cur_field.push(c);
            }
        } else {
            match c {
                '"' => { in_quotes = true; }
                ',' => {
                    cur_row.push(std::mem::take(&mut cur_field));
                }
                '\r' => { /* skip, handle \n */ }
                '\n' => {
                    cur_row.push(std::mem::take(&mut cur_field));
                    if !(cur_row.len() == 1 && cur_row[0].is_empty()) {
                        rows.push(std::mem::take(&mut cur_row));
                    } else {
                        cur_row.clear();
                    }
                }
                _ => { cur_field.push(c); }
            }
        }
    }
    if !cur_field.is_empty() || !cur_row.is_empty() {
        cur_row.push(cur_field);
        if !(cur_row.len() == 1 && cur_row[0].is_empty()) {
            rows.push(cur_row);
        }
    }
    rows
}


#[tauri::command]
fn pomodoro_save_session(
    start_time: String,
    end_time: String,
    duration_secs: i64,
    kind: String,
    status: String,
    label: Option<String>,
    state: State<'_, AppState>,
) -> String {
    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
    let label_ref = label.as_deref();
    match state.db.lock().unwrap().pomodoro_save(&start_time, &end_time, duration_secs, &kind, &status, label_ref, &date) {
        Ok(id) => serde_json::json!({"ok": true, "id": id}).to_string(),
        Err(e) => serde_json::json!({"error": e.to_string()}).to_string(),
    }
}

#[tauri::command]
fn pomodoro_get_today(state: State<'_, AppState>) -> String {
    let date = chrono::Local::now().format("%Y-%m-%d").to_string();
    match state.db.lock().unwrap().pomodoro_today(&date) {
        Ok(v) => v.to_string(),
        Err(e) => serde_json::json!({"error": e.to_string()}).to_string(),
    }
}

#[tauri::command]
fn set_notification_settings(enabled: bool, time: String, state: State<'_, PreferenceState>) -> String {
    if let Ok(mut g) = state.notify_enabled.lock() { *g = enabled; }
    if let Ok(mut g) = state.notify_time.lock() { *g = time.clone(); }
    serde_json::json!({"ok": true, "enabled": enabled, "time": time}).to_string()
}

#[tauri::command]
fn get_notification_settings(state: State<'_, PreferenceState>) -> String {
    let enabled = state.notify_enabled.lock().map(|g| *g).unwrap_or(true);
    let time = state.notify_time.lock().map(|g| g.clone()).unwrap_or_else(|_| "22:00".to_string());
    serde_json::json!({"enabled": enabled, "time": time}).to_string()
}

#[tauri::command]
fn set_backup_settings(enabled: bool, state: State<'_, PreferenceState>) -> String {
    if let Ok(mut g) = state.backup_enabled.lock() { *g = enabled; }
    serde_json::json!({"ok": true, "enabled": enabled}).to_string()
}

#[tauri::command]
fn get_backup_status(state: State<'_, PreferenceState>) -> String {
    let enabled = state.backup_enabled.lock().map(|g| *g).unwrap_or(true);
    let last = state.backup_last.lock().map(|g| g.clone()).unwrap_or_default();
    let path = state.backup_last_path.lock().map(|g| g.clone()).unwrap_or_default();
    serde_json::json!({"enabled": enabled, "last": last, "path": path}).to_string()
}

#[tauri::command]
fn run_backup_now(app: tauri::AppHandle) -> String {
    match perform_backup(&app) {
        Ok(path) => serde_json::json!({"ok": true, "path": path}).to_string(),
        Err(e) => serde_json::json!({"error": e}).to_string(),
    }
}

fn perform_backup(app: &tauri::AppHandle) -> Result<String, String> {
    use tauri::Manager;
    // 找数据库路径
    let data_dir = dirs::data_local_dir()
        .ok_or_else(|| "无法定位数据目录".to_string())?
        .join("daynote");
    let db_path = data_dir.join("daynote.db");
    if !db_path.exists() {
        return Err("数据库文件不存在".to_string());
    }
    // 决定备份目录: 优先用导出目录的 backups 子目录, 否则用 data_local_dir/daynote/backups
    let backup_dir = if let Some(state) = app.try_state::<PreferenceState>() {
        let custom = state.export_dir.lock().ok().and_then(|g| g.clone());
        match custom {
            Some(d) => std::path::PathBuf::from(d).join("backups"),
            None => data_dir.join("backups"),
        }
    } else {
        data_dir.join("backups")
    };
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    let stamp = chrono::Local::now().format("%Y-%m-%d").to_string();
    let target = backup_dir.join(format!("daynote_backup_{}.db", stamp));
    std::fs::copy(&db_path, &target).map_err(|e| e.to_string())?;
    let path_str = target.to_string_lossy().to_string();
    // 更新 last_backup
    if let Some(state) = app.try_state::<PreferenceState>() {
        if let Ok(mut g) = state.backup_last.lock() {
            *g = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        }
        if let Ok(mut g) = state.backup_last_path.lock() {
            *g = path_str.clone();
        }
    }
    // 轮转: 按保留天数清理超过的备份(以 retention_days 为参考, 默认 30)
    if let Ok(entries) = std::fs::read_dir(&backup_dir) {
        let cutoff = chrono::Local::now().naive_local() - chrono::Duration::days(60);
        for entry in entries.flatten() {
            let p = entry.path();
            if !p.is_file() { continue; }
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            if !name.starts_with("daynote_backup_") || !name.ends_with(".db") {
                continue;
            }
            // 解析 daynote_backup_YYYY-MM-DD.db
            let date_part = &name["daynote_backup_".len()..name.len()-3];
            if let Ok(d) = chrono::NaiveDate::parse_from_str(date_part, "%Y-%m-%d") {
                if d.and_hms_opt(0, 0, 0).map(|dt| dt < cutoff).unwrap_or(false) {
                    let _ = std::fs::remove_file(&p);
                }
            }
        }
    }
    Ok(path_str)
}

async fn notification_loop(app: tauri::AppHandle) {
    use tauri::Manager;
    use tauri_plugin_notification::NotificationExt;
    let mut last_notified_date = String::new();
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
        let now = chrono::Local::now();
        let today = now.format("%Y-%m-%d").to_string();
        let now_hm = now.format("%H:%M").to_string();
        let (enabled, target_time) = if let Some(state) = app.try_state::<PreferenceState>() {
            let e = state.notify_enabled.lock().map(|g| *g).unwrap_or(true);
            let t = state.notify_time.lock().map(|g| g.clone()).unwrap_or_else(|_| "22:00".to_string());
            (e, t)
        } else { (false, "22:00".to_string()) };
        if !enabled { continue; }
        if today == last_notified_date { continue; }
        if now_hm != target_time { continue; }
        // 触发通知
        let total_secs = if let Some(state) = app.try_state::<AppState>() {
            state.db.lock().ok()
                .and_then(|db| db.get_summary_by_date(&today).ok())
                .and_then(|v| v["total_focus_secs"].as_i64())
                .unwrap_or(0)
        } else { 0 };
        let h = total_secs / 3600;
        let m = (total_secs % 3600) / 60;
        let body = if total_secs >= 60 {
            format!("今天累计活动 {} 小时 {} 分，点击查看日报", h, m)
        } else {
            "今天没什么记录，点击打开 Daynote".to_string()
        };
        let _ = app.notification()
            .builder()
            .title("Daynote · 今日小结")
            .body(body)
            .show();
        // 通知后弹出窗口? 我们让点击托盘/通知后由用户决定, 这里仅发出
        last_notified_date = today;
    }
}

async fn backup_loop(app: tauri::AppHandle) {
    // 每 6 小时尝试一次, 同一天只备份一次(以日期作为去重键)
    let mut last_backup_date = String::new();
    loop {
        let enabled = if let Some(state) = app.try_state::<PreferenceState>() {
            state.backup_enabled.lock().map(|g| *g).unwrap_or(true)
        } else { true };
        if enabled {
            let today = chrono::Local::now().format("%Y-%m-%d").to_string();
            if today != last_backup_date {
                if perform_backup(&app).is_ok() {
                    last_backup_date = today;
                }
            }
        }
        tokio::time::sleep(std::time::Duration::from_secs(6 * 3600)).await;
    }
}
fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItemBuilder::with_id("show", "打开面板").build(app)?;
    let generate = MenuItemBuilder::with_id("generate", "生成日报").build(app)?;
    let summary = MenuItemBuilder::with_id("summary", "今日统计").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "退出").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show)
        .item(&generate)
        .item(&summary)
        .separator()
        .item(&quit)
        .build()?;

    let mut tray = TrayIconBuilder::new()
        .menu(&menu);
    if let Some(img) = icon::load_tray_icon() {
        tray = tray.icon(img);
    }
    tray
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => {
                let win = app.get_webview_window("main");
                match win {
                    Some(window) => {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                    None => {
                        if let Ok(window) = tauri::WebviewWindowBuilder::new(
                            app,
                            "main",
                            tauri::WebviewUrl::App("index.html".into()),
                        )
                        .title("Daynote")
                        .build() {
                            let _ = window.set_focus();
                        }
                    }
                }
            }
            "generate" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("generate-report", ());
                }
            }
            "summary" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("show-summary", ());
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init();

    let database = db::Database::new().expect("Failed to initialize database");
    // 启动时清理一次历史乱码/超长 URL 记录
    let _ = database.delete_garbage();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, Some(vec![])))
        .plugin(tauri_plugin_notification::init())
        .manage(AppState {
            db: Mutex::new(database),
        })
        .manage(PreferenceState {
            close_to_tray: Mutex::new(true),
            privacy_rules: Mutex::new(Vec::new()),
            export_dir: Mutex::new(None),
            notify_enabled: Mutex::new(true),
            notify_time: Mutex::new("22:00".to_string()),
            backup_enabled: Mutex::new(true),
            backup_last: Mutex::new(String::new()),
            backup_last_path: Mutex::new(String::new()),
        })
        .invoke_handler(tauri::generate_handler![
            get_today_records,
            get_today_summary,
            generate_daily_report,
            generate_daily_report_for_date,
            get_weekly_app_usage,
            generate_weekly_report,
            get_month_app_usage,
            generate_monthly_report,
            cleanup_old_records,
            get_recent_days,
            delete_record,
            set_close_to_tray,
            set_privacy_rules,
            set_autostart,
            get_autostart,
            export_all_data,
            import_data,
            set_export_dir,
            get_export_dir,
            pomodoro_save_session,
            pomodoro_get_today,
            set_notification_settings,
            get_notification_settings,
            set_backup_settings,
            get_backup_status,
            run_backup_now,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let close_to_tray = window
                    .app_handle()
                    .state::<PreferenceState>()
                    .close_to_tray
                    .lock()
                    .map(|value| *value)
                    .unwrap_or(true);

                if close_to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    window.app_handle().exit(0);
                }
            }
        })
        .setup(|app| {
            let _ = setup_tray(app);
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                monitor::start_monitoring(handle).await;
            });
            let h2 = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                notification_loop(h2).await;
            });
            let h3 = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                backup_loop(h3).await;
            });
            // 窗口按需创建，启动时不创建以避开 WebView2 进程冲突
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Daynote");
}
