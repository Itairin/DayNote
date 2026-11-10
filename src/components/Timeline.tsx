import React from "react";

// 分类 → 颜色。应用名归一化统一走后端 db::app_display_name 的结果，
// 前端以前自己又写了一套约 20 条规则，导致 WPS 在今日页显示成灰色的"其他"、
// 在日报里却是"WPS / 文档"。
const CAT_COLOR: Record<string, string> = {
  开发: "#0071e3",
  浏览: "#5ac8fa",
  沟通: "#30b94e",
  邮件: "#34c759",
  文档: "#bf5af2",
  设计: "#ff2d55",
  命令行: "#8e8e93",
  AI: "#5856d6",
  娱乐: "#ff9f0a",
  游戏: "#ff375f",
  系统: "#aeaeb2",
  网盘: "#32ade6",
  下载: "#64d2ff",
  其他: "#aeaeb2",
};

interface Item {
  id?: number;
  window_title: string;
  process_name: string;
  start_time: string;
  end_time: string;
  duration_secs: number;
}

interface Props {
  items: Item[];
  onDelete?: (id: number) => void;
}

function fmtDur(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? m + "分" + s + "秒" : s + "秒";
}

function fmtBlock(rows: Item[]): string {
  if (rows.length <= 1) return "";
  const first = rows[0].start_time.slice(11, 16);
  const last = rows[rows.length - 1].end_time.slice(11, 16);
  return first + " ~ " + last + " · " + rows.length + "次";
}

/** 合并连续的同一条目。分组键用 process + 清洗后的标题，
 *  这样同一应用连着的多段能合成一行，而不是几百行碎片。 */
function mergeItems(items: Item[]) {
  const result: Array<{
    key: string; title: string; process: string; total: number;
    start: string; end: string; rows: Item[];
  }> = [];

  for (const item of items) {
    const title = (item.window_title || "").trim();
    const key = item.process_name + "||" + title;
    const last = result.length > 0 ? result[result.length - 1] : null;
    if (last && last.key === key) {
      last.end = item.end_time;
      last.total += item.duration_secs;
      last.rows.push(item);
    } else {
      result.push({
        key,
        title: title || item.process_name || "未知应用",
        process: item.process_name,
        total: item.duration_secs,
        start: item.start_time,
        end: item.end_time,
        rows: [item],
      });
    }
  }
  return result;
}

export default function Timeline({ items, onDelete }: Props) {
  if (items.length === 0) {
    return React.createElement("div", { className: "empty-state" },
      React.createElement("div", { className: "icon" }, "⏱"),
      React.createElement("p", null, "暂无活动记录")
    );
  }

  const merged = mergeItems(items);

  return React.createElement("div", { className: "timeline" },
    ...merged.map((entry, i) => {
      const color = CAT_COLOR["其他"];
      const canDelete = !!onDelete && entry.rows.length === 1 && typeof entry.rows[0].id === "number";
      return React.createElement("div", { key: i, className: "timeline-item" },
        React.createElement("div", { className: "timeline-time-block" },
          React.createElement("span", null, entry.start.slice(11, 16)),
          React.createElement("span", null, entry.end.slice(11, 16))
        ),
        React.createElement("div", { className: "timeline-dot", style: { background: color } }),
        React.createElement("div", { className: "timeline-content" },
          React.createElement("div", { className: "timeline-row" },
            React.createElement("span", { className: "timeline-title", title: entry.title }, entry.title),
            React.createElement("span", { className: "timeline-duration" }, fmtDur(entry.total)),
            canDelete
              ? React.createElement("button", {
                  className: "timeline-del",
                  title: "删除这条记录（比如开会、私人时间被误记）",
                  onClick: () => {
                    const id = entry.rows[0].id;
                    if (id != null && window.confirm("删除这条记录？删除后不可恢复。")) onDelete!(id);
                  },
                }, "删除")
              : null
          ),
          fmtBlock(entry.rows)
            ? React.createElement("div", { className: "timeline-sub" }, fmtBlock(entry.rows))
            : null
        )
      );
    })
  );
}
