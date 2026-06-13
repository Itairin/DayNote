# Daynote Frontend Design

## Overview

Daynote 前端界面设计，支持三种布局模式切换，默认极简模式，共四个主页面加一个设置面板。

## Layout Modes

Three switchable layouts, stored in React Context + localStorage:

### Minimal (default)
- Top tab bar: Today · Report · Weekly · History + ⚙ (far right)
- Center: large efficiency score ring (SVG circle)
- Below: basic today stats
- Content area: renders current page below

### Dashboard
- Top: same tab bar + ⚙ in corner
- Top-content: row of stat cards (score, total focus time, etc.)
- Middle: activity timeline (scrollable)
- Each page view fills the content area below

### Sidebar
- Left sidebar (44px wide): page nav items stacked vertically, ⚙ at bottom
- Right content area: full-width page content
- Top of content area: secondary tab bar showing current page

## Pages

Four main pages, navigated via tab bar (all layouts):

| Icon | Page | Description |
|------|------|-------------|
| 📊 | TodayView | Efficiency score, activity timeline for today |
| 📝 | ReportView | Daily report preview (Markdown), copy to clipboard |
| 📅 | WeeklyView | Week calendar view, generate weekly report |
| 📈 | HistoryView | Historical records, date picker, search |

**Settings** (⚙): accessible from top-right ⚙ icon (or sidebar bottom in sidebar mode). Not part of main page navigation.

## Component Architecture

```
src/
├── App.tsx                    # Root: LayoutContext provider + layout router
├── App.css                    # Global CSS variables, theme, base styles
├── contexts/
│   ├── LayoutContext.tsx      # layoutMode state + setter, persisted to localStorage
│   └── AppData.tsx            # invoke Tauri commands, cache in React state
├── layouts/
│   ├── LayoutMinimal.tsx      # Minimal layout wrapper
│   ├── LayoutDashboard.tsx    # Dashboard layout wrapper
│   └── LayoutSidebar.tsx      # Sidebar layout wrapper
├── components/
│   ├── ScoreRing.tsx          # SVG efficiency score circle (0-100)
│   ├── Timeline.tsx           # Activity timeline list
│   ├── StatCard.tsx           # Single stat card (number + label)
│   ├── NavBar.tsx             # Shared tab bar component
│   ├── LayoutSwitcher.tsx     # Quick layout toggle dropdown
│   └── SettingsButton.tsx     # ⚙ icon button
└── views/
    ├── TodayView.tsx          # Today's activity + score
    ├── ReportView.tsx         # Report preview + copy
    ├── WeeklyView.tsx         # Week calendar
    ├── HistoryView.tsx        # History records
    └── SettingsView.tsx       # Settings panel (appearance, filters, data)
```

## Data Flow

1. App mounts → `AppData` context calls Tauri commands via `@tauri-apps/api`:
   - `get_today_records()` / `get_today_summary()`
   - `get_recent_days(N)`
   - `generate_daily_report()`
2. LayoutContext reads saved mode from `localStorage("daynote-layout")`
3. User changes layout → LayoutContext updates state + saves to localStorage
4. User navigates pages → NavBar updates active view → App renders matching view

## Styling

- Pure CSS (no Tailwind, no UI library)
- CSS custom properties for theming:
  ```css
  :root {
    --bg: #f5f5f7;
    --surface: #ffffff;
    --text: #1d1d1f;
    --text-secondary: #86868b;
    --accent: #0071e3;
    --success: #30b94e;
    --warning: #ff9f0a;
    --danger: #ff453a;
    --border: #d2d2d7;
  }
  ```
- Dark theme via `[data-theme="dark"]` selector
- System theme detection via `prefers-color-scheme`

## States

Each view handles:
- **Loading**: skeleton placeholders while fetching data
- **Empty**: "No activity today" message, illustration
- **Error**: retry button with error message
- **Data**: normal rendered state

## Implementation Order

1. LayoutContext + NavBar + LayoutSwitcher
2. Three layout wrappers
3. TodayView (main page)
4. ReportView
5. WeeklyView
6. HistoryView
7. SettingsView
8. Dark theme + polish
