<p align="center">
  <img src="assets/icon.png" width="96" height="96" alt="DevPulse">
</p>

<h1 align="center">DevPulse</h1>

<p align="center">Local-first coding activity tracker for VS Code.<br>Heatmaps, streaks, projects, and shareable summaries — all stored on your machine.</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=bistadev.devpulse-code"><img src="https://img.shields.io/badge/VS%20Code-v7.1.0-blue" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License"></a>
  <a href="#privacy"><img src="https://img.shields.io/badge/privacy-local-333" alt="Privacy"></a>
</p>

---

![Dashboard](assets/hero-dashboard.png)

*The DevPulse dashboard shows your day at a glance: active time, streak, goals, and activity heatmap.*

---

## Why DevPulse

DevPulse runs silently in the background while you work. It tracks real coding time — not idle time, not window focus alone — and surfaces patterns you can act on.

- **Build a daily habit.** The streak counter shows how many consecutive days you've written code. Missing a day is visible. Consistency becomes tangible.
- **Know where your time goes.** Project cards break down hours per workspace. See which project dominated your week.
- **Spot trends before they become problems.** Weekly insights compare this week to last week — time, lines, and focus sessions — so you can catch a dip early.
- **Your data never leaves your computer.** No accounts, no cloud sync, no telemetry. The extension works offline and stores everything in a local JSON file.

---

## Features

### Dashboard

![Dashboard](assets/feature-dashboard.png)

The main view shows today's active time, current streak, deep work estimate, and goal progress. A 6-month activity heatmap and weekly bar chart provide context at a glance. Every section updates smoothly without page reloads.

---

### Goals

![Goals](assets/feature-goals.png)

Set daily, weekly, and monthly targets for coding time, lines written, and focus sessions. Each goal displays current progress, remaining amount, and an estimated completion time. Completed goals dim to reduce visual noise.

---

### Weekly Insights

![Weekly Insights](assets/feature-insights.png)

A side-by-side comparison of this week versus last week. See changes in total coding time, average daily output, best day, and focus sessions. Arrows and percentages make direction clear — up is green, down is red.

---

### Projects

![Projects](assets/feature-projects.png)

Every workspace folder is tracked as a project. Sort by total time, recent activity, or days active. Each card shows hours coded, files edited, and the languages used. The list updates automatically as you switch between projects.

---

### Git Activity

![Git Activity](assets/feature-git.png)

When you open a Git repository, DevPulse reads your local commit history. The dashboard shows commits made today, this week, this month, and in total — along with your current branch and recent commit messages. No authentication required. Works entirely offline.

---

### Share Cards

![Share Cards](assets/feature-share.png)

Generate a styled summary of your coding activity. Four templates are included: Professional (gradient, LinkedIn-ready), Minimal (black and white), GitHub (dark theme grid), and Wrapped (annual report style). Each card is copied as HTML — paste it anywhere or screenshot for social media.

---

### Developer Wrapped

![Developer Wrapped](assets/feature-wrapped.png)

A full-screen, slide-based annual report showing your total hours, longest streak, top language, main project, and commits. Navigate with arrow keys or tap. Available for both yearly and monthly views.

---

## Demo

![Demo](assets/demo.gif)

*A short walkthrough showing DevPulse in action is coming soon.*

---

## Privacy

- No cloud storage
- No account required
- No analytics or telemetry
- Works completely offline
- All data stored in a local JSON file inside VS Code's global storage directory
- You can export and delete your data at any time

---

## Installation

Search for **DevPulse** in the VS Code Extensions panel (`Ctrl+Shift+X`) or install from the [Marketplace](https://marketplace.visualstudio.com/items?itemName=bistadev.devpulse-code).

---

## Commands

| Command | Description |
|---------|-------------|
| `DevPulse: Show Dashboard` | Open the main dashboard |
| `DevPulse: Open Yearly Wrapped` | View your annual report |
| `DevPulse: Open Monthly Wrapped` | View your monthly report |
| `DevPulse: Copy Share Card` | Generate and copy a shareable card |
| `DevPulse: Export Data` | Export all tracking data as JSON |

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `devpulse.goals.dailyTime` | `240` | Daily coding time goal (minutes) |
| `devpulse.goals.dailyLines` | `500` | Daily lines written goal |
| `devpulse.goals.dailySessions` | `3` | Daily focus sessions goal |
| `devpulse.goals.weeklyTime` | `1200` | Weekly coding time goal (minutes) |
| `devpulse.goals.weeklyDays` | `5` | Weekly active days goal |
| `devpulse.goals.monthlyTime` | `4800` | Monthly coding time goal (minutes) |
| `devpulse.goals.monthlyDays` | `20` | Monthly active days goal |
| `devpulse.showStatusBar` | `true` | Show activity counter in status bar |

---

## Roadmap

- Pomodoro Mode — timed focus sessions with break reminders
- Custom Themes — personalize the dashboard appearance
- More Share Card Templates — additional layouts and styles
- Team Dashboard — compare stats across a team (local network only)
- Enhanced Git Insights — pull request activity, code review stats
- Export as PNG — one-click image export for share cards

---

## FAQ

**Does DevPulse track me when I'm not coding?**
No. It detects idle time and pauses tracking after 2 minutes of inactivity. It also pauses when VS Code loses focus.

**Where is my data stored?**
In VS Code's global storage directory (`globalStorageUri`). On Windows, this is typically `%APPDATA%/Code/User/globalStorage/`. The file is `devpulse.json`.

**Can I move my data to another computer?**
Yes. Use the `DevPulse: Export Data` command to save a JSON file, then import it on another machine using the extension's import feature.

**Does this work with any language?**
Yes. DevPulse tracks language usage based on file extensions and VS Code language IDs.

**Will this slow down my editor?**
No. Tracking runs on intervals (5 seconds for active time, 30 seconds for saves). Data operations are synchronous file writes with minimal overhead.

---

## Contributing

Bug reports and feature requests are welcome on the [GitHub repository](https://github.com/BistaDinesh03/devpulse-tracker). Pull requests should target the `main` branch and include a description of the change.

---

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Built for developers who want to understand their work, not just count hours.</sub>
</p>