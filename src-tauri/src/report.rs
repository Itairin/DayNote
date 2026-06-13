use std::collections::BTreeMap;

use chrono::Local;

use crate::db::{app_category, app_display_name, category_emoji, clean_window_title, display_title};

pub struct ReportGenerator;

#[derive(Clone)]
struct ReportEntry {
    app_name: String,
    display_title: String,
    category: String,
    start_time: String,
    end_time: String,
    duration_secs: i64,
}

impl ReportGenerator {
    pub fn generate_daily_report(records: &[serde_json::Value], concise: bool) -> String {
        let today = Local::now().format("%Y-%m-%d").to_string();
        if records.is_empty() {
            return format!("# 今日日报 {}\n\n暂无活动记录", today);
        }

        let merged = Self::merge_adjacent_records(records);
        if concise {
            Self::generate_concise_daily_report(&today, &merged)
        } else {
            Self::generate_detail_daily_report(&today, &merged)
        }
    }

    pub fn generate_weekly_report(start_date: &str, days: &[serde_json::Value], concise: bool) -> String {
        if concise {
            Self::generate_weekly_concise(start_date, days)
        } else {
            Self::generate_weekly_detail(start_date, days)
        }
    }

    pub fn generate_monthly_report(year: i32, month: u32, days: &[serde_json::Value], concise: bool) -> String {
        if concise {
            Self::generate_monthly_concise(year, month, days)
        } else {
            Self::generate_monthly_detail(year, month, days)
        }
    }

        fn generate_weekly_concise(start_date: &str, days: &[serde_json::Value]) -> String {
        if days.is_empty() {
            return format!("# 周报简明 {} 起\n\n暂无数据", start_date);
        }

        let mut total_secs = 0i64;
        let mut app_map: std::collections::BTreeMap<String, (&str, i64)> = std::collections::BTreeMap::new();

        for day in days {
            total_secs += day["total_secs"].as_i64().unwrap_or(0);
            if let Some(apps) = day["apps"].as_array() {
                for app in apps {
                    let app_name = app["app_name"].as_str().unwrap_or("未知应用").to_string();
                    let category = app_category(&app_name);
                    let duration = app["duration_secs"].as_i64().unwrap_or(0);
                    let entry = app_map.entry(app_name).or_insert((category, 0));
                    entry.1 += duration;
                }
            }
        }

        let mut items: Vec<(&str, &str, i64)> = app_map.iter().map(|(name, (cat, dur))| (name.as_str(), *cat, *dur)).collect();
        items.sort_by(|a, b| b.2.cmp(&a.2));
        let pad = Self::char_width_by_list(&items);
        let mut report = String::new();
        report.push_str(&format!("# 周报简明 {} 起\n\n", start_date));
        report.push_str(&format!("## 一周总计 · {}\n\n", Self::fmt_duration(total_secs)));
        report.push_str("`	ext\n");
        for (n, c, d) in &items {
            report.push_str(&format!("{}  {}  {}\n", category_emoji(c), Self::pad_right(n, pad), Self::fmt_duration(*d)));
        }
        report.push_str("`\n");
        report
    }

        fn generate_monthly_concise(year: i32, month: u32, days: &[serde_json::Value]) -> String {
        if days.is_empty() {
            return format!("# 月报简明 {:04}-{:02}\n\n暂无数据", year, month);
        }

        let mut total_secs = 0i64;
        let mut app_map: std::collections::BTreeMap<String, (&str, i64)> = std::collections::BTreeMap::new();

        for day in days {
            total_secs += day["total_secs"].as_i64().unwrap_or(0);
            if let Some(apps) = day["apps"].as_array() {
                for app in apps {
                    let app_name = app["app_name"].as_str().unwrap_or("未知应用").to_string();
                    let category = app_category(&app_name);
                    let duration = app["duration_secs"].as_i64().unwrap_or(0);
                    let entry = app_map.entry(app_name).or_insert((category, 0));
                    entry.1 += duration;
                }
            }
        }

        let mut items: Vec<(&str, &str, i64)> = app_map.iter().map(|(name, (cat, dur))| (name.as_str(), *cat, *dur)).collect();
        items.sort_by(|a, b| b.2.cmp(&a.2));
        let pad = Self::char_width_by_list(&items);
        let mut report = String::new();
        report.push_str(&format!("# 月报简明 {:04}-{:02}\n\n", year, month));
        report.push_str(&format!("## 本月总计 · {}\n\n", Self::fmt_duration(total_secs)));
        report.push_str("`	ext\n");
        for (n, c, d) in &items {
            report.push_str(&format!("{}  {}  {}\n", category_emoji(c), Self::pad_right(n, pad), Self::fmt_duration(*d)));
        }
        report.push_str("`\n");
        report
    }

    fn generate_detail_daily_report(today: &str, entries: &[ReportEntry]) -> String {
        let mut buckets: Vec<Vec<ReportEntry>> = (0..6).map(|_| Vec::new()).collect();
        for entry in entries {
            let hour = Self::hour(&entry.start_time);
            let idx = (hour / 4).clamp(0, 5) as usize;
            buckets[idx].push(entry.clone());
        }

        let display_pad = entries.iter().map(|e| Self::char_width(&e.display_title)).max().unwrap_or(0).max(8);

        let mut report = String::new();
        report.push_str(&format!("# 今日日报 {}\n\n", today));
        for (idx, entries) in buckets.iter().enumerate() {
            if entries.is_empty() {
                continue;
            }
            let start = idx * 4;
            let end = start + 4;
            report.push_str(&format!("## {:02}:00 ~ {:02}:00\n\n", start, end));
            report.push_str("```text\n");
            for entry in entries {
                let start_time = entry.start_time.get(11..16).unwrap_or("");
                let end_time = entry.end_time.get(11..16).unwrap_or("");
                let padded = Self::pad_right(&entry.display_title, display_pad);
                report.push_str(&format!(
                    "{} - {}  {}  {}  {}\n",
                    start_time,
                    end_time,
                    category_emoji(&entry.category),
                    padded,
                    Self::fmt_duration(entry.duration_secs)
                ));
            }
            report.push_str("```\n\n");
        }
        report
    }

    fn generate_concise_daily_report(today: &str, entries: &[ReportEntry]) -> String {
        let mut buckets: Vec<(&str, BTreeMap<String, (String, i64)>)> = vec![
            ("上午", BTreeMap::new()),
            ("下午", BTreeMap::new()),
            ("晚上", BTreeMap::new()),
        ];

        for entry in entries {
            let idx = match Self::hour(&entry.start_time) {
                h if h < 12 => 0,
                h if h < 18 => 1,
                _ => 2,
            };
            let bucket = &mut buckets[idx].1;
            let value = bucket.entry(entry.app_name.clone()).or_insert((entry.category.clone(), 0));
            value.1 += entry.duration_secs;
        }

        let mut report = String::new();
        report.push_str(&format!("# 今日日报简明版 {}\n\n", today));
        for (period, apps) in buckets {
            if apps.is_empty() {
                continue;
            }
            let total: i64 = apps.values().map(|v| v.1).sum();
            report.push_str(&format!("## {} · {}\n\n", period, Self::fmt_duration(total)));
            let mut apps: Vec<_> = apps.into_iter().collect();
            apps.sort_by(|a, b| b.1.1.cmp(&a.1.1));
            let pad = apps.iter().map(|(name, _)| Self::char_width(name)).max().unwrap_or(0).max(8);
            report.push_str("```text\n");
            for (app_name, (category, duration)) in apps {
                let padded = Self::pad_right(&app_name, pad);
                report.push_str(&format!(
                    "{}  {}  {}\n",
                    category_emoji(&category),
                    padded,
                    Self::fmt_duration(duration)
                ));
            }
            report.push_str("```\n\n");
        }
        report
    }

    fn merge_adjacent_records(records: &[serde_json::Value]) -> Vec<ReportEntry> {
        let mut merged: Vec<ReportEntry> = Vec::new();
        for record in records {
            let raw_title = record["window_title"].as_str().unwrap_or("");
            let cleaned = clean_window_title(raw_title);
            let process = record["process_name"].as_str().unwrap_or("");
            let app_name = app_display_name(process, &cleaned);
            let display = display_title(process, raw_title);
            let category = app_category(&app_name).to_string();
            let start_time = record["start_time"].as_str().unwrap_or("").to_string();
            let end_time = record["end_time"].as_str().unwrap_or("").to_string();
            let duration_secs = record["duration_secs"].as_i64().unwrap_or(0);

            if let Some(last) = merged.last_mut() {
                if last.display_title == display {
                    last.end_time = end_time;
                    last.duration_secs += duration_secs;
                    continue;
                }
            }

            merged.push(ReportEntry {
                app_name,
                display_title: display,
                category,
                start_time,
                end_time,
                duration_secs,
            });
        }
        merged
    }

    fn hour(timestamp: &str) -> i32 {
        timestamp.get(11..13).and_then(|value| value.parse::<i32>().ok()).unwrap_or(23)
    }

    fn char_width(text: &str) -> usize {
        text.chars().map(|c| if (c as u32) > 0x7f { 2 } else { 1 }).sum()
    }

    fn pad_right(text: &str, target_width: usize) -> String {
        let w = Self::char_width(text);
        if target_width <= w {
            text.to_string()
        } else {
            format!("{}{}", text, " ".repeat(target_width - w))
        }
    }

    fn generate_weekly_detail(start_date: &str, days: &[serde_json::Value]) -> String {
        if days.is_empty() {
            return format!("# 周报详细 {} 起\n\n暂无数据", start_date);
        }
        let mut total = 0i64;
        let mut report = String::new();
        report.push_str(&format!("# 周报详细 {} 起\n\n", start_date));
        for day in days {
            let dt = day["date"].as_str().unwrap_or("未知");
            let day_total = day["total_secs"].as_i64().unwrap_or(0);
            total += day_total;
            report.push_str(&format!("## {} · {}\n\n", dt, Self::fmt_duration(day_total)));
            if let Some(apps) = day["apps"].as_array() {
                let mut items: Vec<(&str, &str, i64)> = Vec::new();
                for app in apps {
                    let n = app["app_name"].as_str().unwrap_or("未知");
                    let c = app_category(n);
                    let d = app["duration_secs"].as_i64().unwrap_or(0);
                    items.push((n, c, d));
                }
                items.sort_by(|a, b| b.2.cmp(&a.2));
                let pad = Self::char_width_by_list(&items);
                report.push_str("`	ext\n");
                for (n, c, d) in items {
                    report.push_str(&format!("{}  {}  {}\n", category_emoji(c), Self::pad_right(n, pad), Self::fmt_duration(d)));
                }
                report.push_str("`\n\n");
            }
        }
        report.push_str(&format!("## 一周总计\n\n{}\n", Self::fmt_duration(total)));
        report
    }

    fn generate_monthly_detail(year: i32, month: u32, days: &[serde_json::Value]) -> String {
        if days.is_empty() {
            return format!("# 月报详细 {:04}-{:02}\n\n暂无数据", year, month);
        }
        let mut total = 0i64;
        let mut report = String::new();
        report.push_str(&format!("# 月报详细 {:04}-{:02}\n\n", year, month));
        for day in days {
            let dt = day["date"].as_str().unwrap_or("未知");
            let day_total = day["total_secs"].as_i64().unwrap_or(0);
            total += day_total;
            report.push_str(&format!("## {} · {}\n\n", dt, Self::fmt_duration(day_total)));
            if let Some(apps) = day["apps"].as_array() {
                let mut items: Vec<(&str, &str, i64)> = Vec::new();
                for app in apps {
                    let n = app["app_name"].as_str().unwrap_or("未知");
                    let c = app_category(n);
                    let d = app["duration_secs"].as_i64().unwrap_or(0);
                    items.push((n, c, d));
                }
                items.sort_by(|a, b| b.2.cmp(&a.2));
                let pad = Self::char_width_by_list(&items);
                report.push_str("`	ext\n");
                for (n, c, d) in items {
                    report.push_str(&format!("{}  {}  {}\n", category_emoji(c), Self::pad_right(n, pad), Self::fmt_duration(d)));
                }
                report.push_str("`\n\n");
            }
        }
        report.push_str(&format!("## 本月总计\n\n{}\n", Self::fmt_duration(total)));
        report
    }

    fn char_width_by_list(list: &[(&str, &str, i64)]) -> usize {
        list.iter().map(|(name, _, _)| Self::char_width(name)).max().unwrap_or(0).max(8)
    }

    fn fmt_duration(secs: i64) -> String {
        let hours = secs / 3600;
        let mins = (secs % 3600) / 60;
        if hours > 0 { format!("{}小时{}分钟", hours, mins) } else { format!("{}分钟", mins) }
    }
}
