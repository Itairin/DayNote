# Daynote · 自动日报

Windows 桌面端的本地窗口活动记录与日/周/月报生成工具。纯本地运行，不联网、不上传数据。

- 后端：Rust + Tauri 2
- 前端：React + TypeScript + Vite
- 存储：SQLite（位于 `%LOCALAPPDATA%\daynote\daynote.db`）

## 功能

- 后台监控前台窗口，合并同一应用的多个窗口为一段会话
- 浏览器仍按标签 title 切割，保留浏览过的页面明细
- 今日 / 日报（明细版 + 简明版） / 周报 / 月报 / 历史 / 番茄钟 / 设置
- 自定义数据保留时长、自动每日通知、定时数据库备份
- 一键导出 / 导入数据（JSON、CSV）
- 支持开机自启、关闭最小化到托盘
- 隐私过滤、乱码标题自动剔除
- 极简 / 详细 两种布局，顶栏 / 侧栏可切换

## 开发

```bash
# 依赖
npm install

# 开发模式（热重载）
npm run tauri dev

# 构建 release exe（不打安装包）
npm run tauri build -- --no-bundle

# 构建 NSIS 安装包
npm run tauri build -- --bundles nsis
```

构建产物：
- 主程序：`src-tauri/target/release/daynote.exe`
- 安装包：`src-tauri/target/release/bundle/nsis/Daynote_*.exe`

## 作者

- GitHub: [Itairin](https://github.com/Itairin)
- 赞助: [爱发电](https://www.ifdian.net/a/itair)

License: MIT