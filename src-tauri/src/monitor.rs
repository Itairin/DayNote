use chrono::{DateTime, Local};
use std::collections::HashMap;
use tauri::{AppHandle, Manager};
use crate::{AppState, PreferenceState};

const POLL_SECS: i64 = 3;
/// 无键盘/鼠标输入超过这个秒数，视为空闲：停止计时并切断当前会话。
const IDLE_LIMIT_SECS: u64 = 300;
/// 进行中的会话每隔多少秒落一次库，崩溃最多丢这么久。
const FLUSH_SECS: i64 = 60;

/// 按方案 C 切割: 浏览器进程仍按 title, 其它进程按 process 合并多窗口
fn session_key(process: &str, title: &str) -> String {
    if crate::db::is_browser_process(process, title) {
        format!("BROWSER::{}::{}", process.to_lowercase(), title)
    } else {
        format!("PROC::{}", process.to_lowercase())
    }
}

/// 读一次当前的隐私规则快照。之前这些规则只被写进 Mutex、从来没人读，
/// 导致设置页承诺的"匹配的应用将不会被记录"完全落空。
fn current_privacy_rules(app: &AppHandle) -> Vec<String> {
    app.try_state::<PreferenceState>()
        .and_then(|s| s.privacy_rules.lock().ok().map(|g| g.clone()))
        .unwrap_or_default()
}

/// 命中任意一条隐私规则即跳过。规则按应用名/进程名/标题关键词做不区分大小写的包含匹配。
fn is_private(process: &str, title: &str, rules: &[String]) -> bool {
    if rules.is_empty() {
        return false;
    }
    let p = process.to_lowercase();
    let t = title.to_lowercase();
    // 用后端已有的应用名归一化，这样"微信"这种中文规则才能命中 Weixin.exe
    let app = crate::db::app_display_name(process, title).to_lowercase();
    rules.iter().any(|rule| {
        let r = rule.trim().to_lowercase();
        if r.is_empty() {
            return false;
        }
        p.contains(&r) || t.contains(&r) || app.contains(&r)
    })
}

pub async fn start_monitoring(app: AppHandle) {
    let mut cur_key = String::new();
    let mut cur_proc = String::new();
    let mut cur_title = String::new();
    // 同段内每个 title 的累计停留秒数 (用于结束时挑代表 title)
    let mut title_durations: HashMap<String, i64> = HashMap::new();
    let mut start: Option<DateTime<Local>> = None;
    let mut last_tick: Option<DateTime<Local>> = None;
    let mut last_flush: Option<DateTime<Local>> = None;
    let mut flush_id: Option<i64> = None;

    loop {
        tokio::time::sleep(std::time::Duration::from_secs(POLL_SECS as u64)).await;
        let now = Local::now();

        // 空闲检测：有人动了键鼠才继续计时。
        // 没有这一步时，"开始菜单停留 50 分钟""抖音挂机 7 小时"都会被算成专注。
        if is_idle(IDLE_LIMIT_SECS) {
            if let Some(s) = start {
                end_session(&app, &cur_proc, &title_durations, &cur_title, s, now, flush_id).await;
                start = None;
                last_tick = None;
                last_flush = None;
                flush_id = None;
                cur_key.clear();
                cur_proc.clear();
                cur_title.clear();
                title_durations.clear();
            }
            continue;
        }

        let info = get_active_window_info();
        match info {
            Some((title, process)) => {
                let rules = current_privacy_rules(&app);
                if should_skip(&title) || should_skip_process(&process) || is_private(&process, &title, &rules) {
                    if let Some(s) = start {
                        end_session(&app, &cur_proc, &title_durations, &cur_title, s, now, flush_id).await;
                        start = None;
                        last_tick = None;
                        last_flush = None;
                        flush_id = None;
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
                        end_session(&app, &cur_proc, &title_durations, &cur_title, s, now, flush_id).await;
                    }
                    cur_key = new_key;
                    cur_proc = process;
                    cur_title = title.clone();
                    title_durations.clear();
                    title_durations.insert(title, 0);
                    start = Some(now);
                    last_tick = Some(now);
                    last_flush = Some(now);
                    flush_id = None;
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

                // 周期性落库：崩溃/断电最多丢 FLUSH_SECS 秒，而不是一整段。
                if let Some(s) = start {
                    let since_flush = last_flush.map(|f| (now - f).num_seconds()).unwrap_or(i64::MAX);
                    if since_flush >= FLUSH_SECS {
                        let dur = (now - s).num_seconds();
                        if dur >= POLL_SECS {
                            let rep = representative_title(&title_durations, &cur_title);
                            let date = s.format("%Y-%m-%d").to_string();
                            let start_s = s.format("%Y-%m-%dT%H:%M:%S").to_string();
                            let end_s = now.format("%Y-%m-%dT%H:%M:%S").to_string();
                            if let Some(state) = app.try_state::<AppState>() {
                                if let Ok(db) = state.db.lock() {
                                    match db.progress_upsert(&rep, &cur_proc, &start_s, &end_s, dur, &date) {
                                        Ok(id) => flush_id = Some(id),
                                        Err(e) => eprintln!("Daynote: flush fail: {}", e),
                                    }
                                }
                            }
                        }
                        last_flush = Some(now);
                    }
                }
            }
            None => {
                if let Some(s) = start {
                    end_session(&app, &cur_proc, &title_durations, &cur_title, s, now, flush_id).await;
                    start = None;
                    last_tick = None;
                    last_flush = None;
                    flush_id = None;
                    cur_key.clear();
                    cur_proc.clear();
                    cur_title.clear();
                    title_durations.clear();
                }
            }
        }
    }
}

fn representative_title(title_durations: &HashMap<String, i64>, last_title: &str) -> String {
    title_durations
        .iter()
        .max_by_key(|(_, secs)| **secs)
        .map(|(t, _)| t.clone())
        .filter(|t| !t.is_empty())
        .unwrap_or_else(|| last_title.to_string())
}

/// 结束会话。若这段会话已经被周期性落库过（flush_id 存在），就更新那条记录，
/// 避免同一段会话在库里出现两条。
async fn end_session(
    app: &AppHandle,
    process: &str,
    title_durations: &HashMap<String, i64>,
    last_title: &str,
    start: DateTime<Local>,
    end: DateTime<Local>,
    flush_id: Option<i64>,
) {
    let dur = (end - start).num_seconds();
    if dur < POLL_SECS {
        return;
    }
    let rep_title = representative_title(title_durations, last_title);

    let date = start.format("%Y-%m-%d").to_string();
    let start_s = start.format("%Y-%m-%dT%H:%M:%S").to_string();
    let end_s = end.format("%Y-%m-%dT%H:%M:%S").to_string();

    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(db) = state.db.lock() {
            // 有 flush_id 说明这条已经在库里了，收尾时更新而不是再插一条
            let result = match flush_id {
                Some(_) => db.progress_upsert(&rep_title, process, &start_s, &end_s, dur, &date).map(|_| ()),
                None => db.insert_record(&rep_title, process, &start_s, &end_s, dur, &date).map(|_| ()),
            };
            if let Err(e) = result {
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
        // 只跳过登录/锁屏类标题，不要用 starts_with("lock") 误杀 LockDown Browser 等正常窗口
        || t == "lockapp.exe"
        || t.starts_with("锁定")
}

/// Daynote 自己的窗口不该被记录成"专注"。
fn should_skip_process(process: &str) -> bool {
    let p = process.to_lowercase();
    p.is_empty() || p == "unknown" || p.contains("daynote")
}

/// 距离最后一次键盘/鼠标输入过了多少毫秒；取不到时返回 0（视为有输入，宁可多记不少记）。
#[cfg(windows)]
fn idle_millis() -> u32 {
    use windows::Win32::System::SystemInformation::GetTickCount;
    use windows::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

    unsafe {
        let mut info = LASTINPUTINFO {
            cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
            dwTime: 0,
        };
        if GetLastInputInfo(&mut info).as_bool() {
            let now = GetTickCount();
            now.wrapping_sub(info.dwTime)
        } else {
            0
        }
    }
}

#[cfg(not(windows))]
fn idle_millis() -> u32 {
    0
}

fn is_idle(limit_secs: u64) -> bool {
    (idle_millis() as u64 / 1000) >= limit_secs
}

#[cfg(windows)]
fn get_active_window_info() -> Option<(String, String)> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
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
