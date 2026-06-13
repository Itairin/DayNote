use chrono::{DateTime, Local};
use std::collections::HashMap;
use tauri::{AppHandle, Manager};
use crate::AppState;

const POLL_SECS: i64 = 3;

/// 按方案 C 切割: 浏览器进程仍按 title, 其它进程按 process 合并多窗口
fn session_key(process: &str, title: &str) -> String {
    if crate::db::is_browser_process(process, title) {
        format!("BROWSER::{}::{}", process.to_lowercase(), title)
    } else {
        format!("PROC::{}", process.to_lowercase())
    }
}

pub async fn start_monitoring(app: AppHandle) {
    let mut cur_key = String::new();
    let mut cur_proc = String::new();
    let mut cur_title = String::new();
    // 同段内每个 title 的累计停留秒数 (用于结束时挑代表 title)
    let mut title_durations: HashMap<String, i64> = HashMap::new();
    let mut start: Option<DateTime<Local>> = None;
    let mut last_tick: Option<DateTime<Local>> = None;

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(POLL_SECS as u64)).await;
        let now = Local::now();

        let info = get_active_window_info();
        match info {
            Some((title, process)) => {
                if should_skip(&title) {
                    if let Some(s) = start {
                        end_session(&app, &cur_proc, &title_durations, &cur_title, s, now).await;
                        start = None;
                        last_tick = None;
                        cur_key.clear();
                        cur_proc.clear();
                        cur_title.clear();
                        title_durations.clear();
                    }
                    continue;
                }
                let new_key = session_key(&process, &title);
                if new_key != cur_key {
                    // 切到新会话
                    if let Some(s) = start {
                        end_session(&app, &cur_proc, &title_durations, &cur_title, s, now).await;
                    }
                    cur_key = new_key;
                    cur_proc = process;
                    cur_title = title.clone();
                    title_durations.clear();
                    title_durations.insert(title, 0);
                    start = Some(now);
                    last_tick = Some(now);
                } else {
                    // 同会话: 把"上次 tick 到现在"的时间累计到上一个观察到的 title 头上
                    if let Some(prev_tick) = last_tick {
                        let elapsed = (now - prev_tick).num_seconds().max(0);
                        if elapsed > 0 {
                            *title_durations.entry(cur_title.clone()).or_insert(0) += elapsed;
                        }
                    }
                    cur_title = title.clone();
                    title_durations.entry(title).or_insert(0);
                    last_tick = Some(now);
                }
            }
            None => {
                if let Some(s) = start {
                    end_session(&app, &cur_proc, &title_durations, &cur_title, s, now).await;
                    start = None;
                    last_tick = None;
                    cur_key.clear();
                    cur_proc.clear();
                    cur_title.clear();
                    title_durations.clear();
                }
            }
        }
    }
}

async fn end_session(
    app: &AppHandle,
    process: &str,
    title_durations: &HashMap<String, i64>,
    last_title: &str,
    start: DateTime<Local>,
    end: DateTime<Local>,
) {
    let dur = (end - start).num_seconds();
    if dur < POLL_SECS {
        return;
    }
    // 挑停留最久的 title 做这段记录的代表
    let rep_title = title_durations
        .iter()
        .max_by_key(|(_, secs)| **secs)
        .map(|(t, _)| t.clone())
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| last_title.to_string());

    let date = start.format("%Y-%m-%d").to_string();
    let start_s = start.format("%Y-%m-%dT%H:%M:%S").to_string();
    let end_s = end.format("%Y-%m-%dT%H:%M:%S").to_string();

    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(db) = state.db.lock() {
            if let Err(e) = db.insert_record(&rep_title, process, &start_s, &end_s, dur, &date) {
                eprintln!("Daynote: insert fail: {}", e);
            }
        }
    }
}

fn should_skip(title: &str) -> bool {
    if title.is_empty() { return true; }
    if crate::db::is_garbage_title(title) { return true; }
    let t = title.to_lowercase();
    t.is_empty()
        || t == "桌面"
        || t == "desktop"
        || t.contains("program manager")
        || t.contains("screen saver")
        || t.contains("窗口锁定")
        || t.starts_with("lock")
}

#[cfg(windows)]
fn get_active_window_info() -> Option<(String, String)> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::ProcessStatus::GetModuleBaseNameW;
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
        PROCESS_QUERY_INFORMATION, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
    };

    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.is_invalid() || hwnd.0.is_null() {
            return None;
        }

        let mut buf: [u16; 512] = [0; 512];
        let len = GetWindowTextW(hwnd, &mut buf);
        if len == 0 {
            return None;
        }
        let title = OsString::from_wide(&buf[..len as usize])
            .to_string_lossy().into_owned();

        let mut pid: u32 = 0;
        let _ = GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return Some((title, "unknown".into()));
        }

        // 先用 LIMITED 权限尝试 (无需特权), 失败再退到 PROCESS_QUERY_INFORMATION
        let opened_limited = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
        let opened_full = if opened_limited.is_err() {
            OpenProcess(PROCESS_QUERY_INFORMATION, false, pid)
        } else {
            opened_limited
        };
        match opened_full {
            Ok(handle) => {
                let mut full_buf: [u16; 1024] = [0; 1024];
                let mut full_len: u32 = full_buf.len() as u32;
                let qres = QueryFullProcessImageNameW(
                    handle,
                    PROCESS_NAME_WIN32,
                    windows::core::PWSTR(full_buf.as_mut_ptr()),
                    &mut full_len,
                );
                if qres.is_ok() && full_len > 0 {
                    let full = OsString::from_wide(&full_buf[..full_len as usize])
                        .to_string_lossy().into_owned();
                    let base = full.rsplit(|c| c == '\\' || c == '/').next().unwrap_or(&full).to_string();
                    let _ = windows::Win32::Foundation::CloseHandle(handle);
                    if !base.trim().is_empty() {
                        return Some((title, base));
                    }
                }
                let mut exe_buf: [u16; 260] = [0; 260];
                let exe_len = GetModuleBaseNameW(handle, None, &mut exe_buf);
                let _ = windows::Win32::Foundation::CloseHandle(handle);
                if exe_len > 0 {
                    let name = OsString::from_wide(&exe_buf[..exe_len as usize])
                        .to_string_lossy().into_owned();
                    if !name.trim().is_empty() {
                        return Some((title, name));
                    }
                }
                Some((title, format!("pid_{}", pid)))
            }
            Err(_) => Some((title, format!("pid_{}", pid))),
        }
    }
}

#[cfg(not(windows))]
fn get_active_window_info() -> Option<(String, String)> {
    None
}
