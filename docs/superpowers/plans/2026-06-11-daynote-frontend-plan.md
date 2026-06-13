# Daynote 前端界面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build three switchable layout modes with four main pages plus settings panel for the Daynote app.

**Architecture:** React Context for layout mode + data, pure CSS with CSS variables for theming, @tauri-apps/api for backend calls. Three layout wrappers render the same set of page views.

**Tech Stack:** React 19, TypeScript, Vite, pure CSS, @tauri-apps/api

---

### Task 1: App.css — Global styles, CSS variables, dark theme

**Files:**
- Create: `D:\Itair\DayNote\src\App.css`

- [ ] Write global CSS with variables and theming

- [ ] Verify file written: `Test-Path D:\Itair\DayNote\src\App.css`


### Task 2: LayoutContext — Layout mode state management

**Files:**
- Create: `D:\Itair\DayNote\src\contexts\LayoutContext.tsx`

- [ ] Write LayoutContext provider with mode/currentView state + localStorage persistence

- [ ] Verify TypeScript: `cd D:\Itair\DayNote && npx tsc --noEmit`


### Task 3: AppData — Tauri command wrapper context

**Files:**
- Create: `D:\Itair\DayNote\src\contexts\AppData.tsx`

- [ ] Write AppData provider wrapping 5 Tauri commands

- [ ] Verify TypeScript: `cd D:\Itair\DayNote && npx tsc --noEmit`


### Task 4: Shared components — NavBar, ScoreRing, StatCard, Timeline, LayoutSwitcher

**Files:**
- Create: `D:\Itair\DayNote\src\components\NavBar.tsx`
- Create: `D:\Itair\DayNote\src\components\ScoreRing.tsx`
- Create: `D:\Itair\DayNote\src\components\StatCard.tsx`
- Create: `D:\Itair\DayNote\src\components\Timeline.tsx`
- Create: `D:\Itair\DayNote\src\components\LayoutSwitcher.tsx`

- [ ] Write 5 component files

- [ ] Verify TypeScript: `cd D:\Itair\DayNote && npx tsc --noEmit`


### Task 5: Layout wrappers — Minimal, Dashboard, Sidebar

**Files:**
- Create: `D:\Itair\DayNote\src\layouts\LayoutMinimal.tsx`
- Create: `D:\Itair\DayNote\src\layouts\LayoutDashboard.tsx`
- Create: `D:\Itair\DayNote\src\layouts\LayoutSidebar.tsx`

- [ ] Write 3 layout files

- [ ] Verify TypeScript: `cd D:\Itair\DayNote && npx tsc --noEmit`


### Task 6: View pages — Today, Report, Weekly, History, Settings

**Files:**
- Create: `D:\Itair\DayNote\src\views\TodayView.tsx`
- Create: `D:\Itair\DayNote\src\views\ReportView.tsx`
- Create: `D:\Itair\DayNote\src\views\WeeklyView.tsx`
- Create: `D:\Itair\DayNote\src\views\HistoryView.tsx`
- Create: `D:\Itair\DayNote\src\views\SettingsView.tsx`

- [ ] Write 5 view files

- [ ] Verify TypeScript: `cd D:\Itair\DayNote && npx tsc --noEmit`


### Task 7: App.tsx — Wire everything together

**Files:**
- Modify: `D:\Itair\DayNote\src\App.tsx`

- [ ] Rewrite App.tsx with LayoutProvider + AppDataProvider + theme detection + view router

- [ ] Verify TypeScript: `cd D:\Itair\DayNote && npx tsc --noEmit`


### Task 8: Full frontend build

- [ ] Run `cd D:\Itair\DayNote && npm run build` — verify zero errors

- [ ] Run `cd D:\Itair\DayNote && npx tauri dev` — verify app launches
