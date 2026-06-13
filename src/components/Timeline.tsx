import React from "react";
const BROWSERS = new Set(["Microsoft Edge", "Google Chrome", "Firefox"]);
const CAT = {
  "VS Code": ["开发", "#0071e3", "\u{1f6e0}\u{fe0f}"],
  "JetBrains IDE": ["开发", "#0071e3", "\u{1f6e0}\u{fe0f}"],
  "Cursor": ["开发", "#0071e3", "\u{1f6e0}\u{fe0f}"],
  "Microsoft Edge": ["浏览", "#5ac8fa", "\u{1f310}"],
  "Google Chrome": ["浏览", "#5ac8fa", "\u{1f310}"],
  "Firefox": ["浏览", "#5ac8fa", "\u{1f310}"],
  "微信": ["沟通", "#30b94e", "\u{1f4ac}"],
  "钉钉": ["沟通", "#30b94e", "\u{1f4ac}"],
  "飞书": ["沟通", "#30b94e", "\u{1f4ac}"],
  "QQ": ["沟通", "#30b94e", "\u{1f4ac}"],
  "腾讯会议": ["沟通", "#30b94e", "\u{1f4ac}"],
  "Word": ["文档", "#bf5af2", "\u{1f4c4}"],
  "Excel": ["文档", "#bf5af2", "\u{1f4c4}"],
  "PowerPoint": ["文档", "#bf5af2", "\u{1f4c4}"],
  "Notion": ["文档", "#bf5af2", "\u{1f4c4}"],
  "WPS": ["文档", "#bf5af2", "\u{1f4c4}"],
  "终端": ["命令行", "#8e8e93", "\u{1f4bb}"],
  "网易云音乐": ["娱乐", "#ff9f0a", "\u{1f3b5}"],
  "QQ音乐": ["娱乐", "#ff9f0a", "\u{1f3b5}"],
  "Spotify": ["娱乐", "#ff9f0a", "\u{1f3b5}"],
  "Steam": ["娱乐", "#ff9f0a", "\u{1f3b5}"],
  "文件资源管理器": ["系统", "#aeaeb2", "\u{1f5c2}\u{fe0f}"],
};
const CAT_FALLBACK = ["其他", "#aeaeb2", "\u{1f4ca}"];

interface Item {
  window_title: string;
  process_name: string;
  start_time: string;
  end_time: string;
  duration_secs: number;
}
interface Props { items: Item[] }

function cleanTitle(t: string): string {
  let s = t.trim().replace(" - 个人", "");
  while (true) {
    const start = s.indexOf("和另外"); if (start < 0) break;
    const tail = s.indexOf("个页面", start); if (tail < 0) break;
    const end = tail + "个页面".length;
    const before = s.slice(0, start).trimEnd();
    const after = s.slice(end).trimStart();
    s = after.startsWith("-") && before.length > 0 ? before + " " + after : before + after;
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

function appName(process: string, title: string): string {
  const p = process.toLowerCase();
  if (p.includes("msedge") || /Edge/.test(title)) return "Microsoft Edge";
  if (p.includes("chrome") || /Chrome/.test(title)) return "Google Chrome";
  if (p.includes("firefox") || /Firefox/.test(title)) return "Firefox";
  if (p.includes("code") || /VS Code/.test(title)) return "VS Code";
  if (p.includes("wechat") || /微信/.test(title)) return "微信";
  if (p.includes("dingtalk") || /钉钉/.test(title)) return "钉钉";
  if (p.includes("feishu") || p.includes("lark") || /飞书/.test(title)) return "飞书";
  if (p.includes("qq") && !p.includes("music")) return "QQ";
  if (p.includes("tencent") && p.includes("meeting")) return "腾讯会议";
  if (p.includes("cloudmusic") || /网易云音乐/.test(title)) return "网易云音乐";
  if (p.includes("qqmusic") || /QQ音乐/.test(title)) return "QQ音乐";
  if (p.includes("spotify")) return "Spotify";
  if (p.includes("explorer")) return "文件资源管理器";
  if (p.includes("notion")) return "Notion";
  if (p.includes("steam")) return "Steam";
  if (p.includes("powershell") || p.includes("cmd") || /Terminal|PowerShell/.test(title)) return "终端";
  if (p.includes("winword") || /Word/.test(title)) return "Word";
  if (p.includes("excel") || /Excel/.test(title)) return "Excel";
  if (p.includes("powerpnt") || /PowerPoint/.test(title)) return "PowerPoint";
  if (process && process !== "unknown") return process.replace(/\.exe$/i, "");
  return cleanTitle(title) || "未知应用";
}

function isBrowser(name: string): boolean { return BROWSERS.has(name); }

function catInfo(name: string): [string, string, string] {
  const v = (CAT as any)[name];
  return v ? v : CAT_FALLBACK;
}

function mergedTimeline(items: Item[]): Array<{
  key: string; name: string; isBrowser: boolean; browserTab?: string;
  total: number; start: string; end: string; rows: Item[];
}> {
  const result: Array<any> = [];
  for (const item of items) {
    const raw = item.window_title;
    const cleaned = cleanTitle(raw);
    const name = appName(item.process_name, cleaned);
    const browser = isBrowser(name);
    const entryKey = browser ? `${name}||${cleaned}` : name;
    const last = result.length > 0 ? result[result.length - 1] : null;

    if (last && last.key === entryKey) {
      last.end = item.end_time;
      last.total += item.duration_secs;
      last.rows.push(item);
    } else {
      result.push({
        key: entryKey,
        name,
        isBrowser: browser,
        browserTab: browser ? cleaned : undefined,
        total: item.duration_secs,
        start: item.start_time,
        end: item.end_time,
        rows: [item],
      });
    }
  }
  return result;
}

function fmtDur(secs: number): string {
  const m = Math.floor(secs / 60); const s = secs % 60;
  return m > 0 ? m + "分" + s + "秒" : s + "秒";
}

function fmtBlock(rows: Item[]): string {
  if (rows.length <= 1) return "";
  const first = rows[0].start_time.slice(11, 16);
  const last = rows[rows.length - 1].end_time.slice(11, 16);
  return first + " ~ " + last + " \u00b7 " + rows.length + "\u6b21";
}

export default function Timeline({ items }: Props) {
  if (items.length === 0) {
    return React.createElement("div", { className: "empty-state" },
      React.createElement("div", { className: "icon" }, "\u23f1"),
      React.createElement("p", null, "\u6682\u65e0\u6d3b\u52a8\u8bb0\u5f55")
    );
  }

  const merged = mergedTimeline(items);
  return React.createElement("div", { className: "timeline" },
    ...merged.map((entry, i) => {
      const [category, color] = catInfo(entry.name);
      return React.createElement("div", { key: i, className: "timeline-item" },
        React.createElement("div", { className: "timeline-time-block" },
          React.createElement("span", null, entry.start.slice(11, 16)),
          React.createElement("span", null, entry.end.slice(11, 16))
        ),
        React.createElement("div", { className: "timeline-dot", style: { background: color } }),
        React.createElement("div", { className: "timeline-content" },
          React.createElement("div", { className: "timeline-row" },
            React.createElement("span", { className: "timeline-category", style: { background: color } },
              catInfo(entry.name)[2],
              " ",
              category
            ),
            React.createElement("span", { className: "timeline-title" }, entry.name),
            React.createElement("span", { className: "timeline-duration" }, fmtDur(entry.total))
          ),
          entry.isBrowser && entry.browserTab
            ? React.createElement("div", { className: "timeline-sub" }, entry.browserTab)
            : fmtBlock(entry.rows)
              ? React.createElement("div", { className: "timeline-sub" }, fmtBlock(entry.rows))
              : null
        )
      );
    })
  );
}
