<p align="center">
  <img src="images/icon.png" width="80" height="80" alt="DevPulse icon">
</p>

<h1 align="center">DevPulse</h1>

<p align="center">
  <strong>Local-first coding activity tracker for VS Code.</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=bistadev.devpulse-code"><img src="https://img.shields.io/badge/version-7.2.0-blue?style=flat-square" alt="Version 7.2.0"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="MIT License"></a>
</p>

---

DevPulse is a local-first coding activity tracker for VS Code. It runs quietly in the background and turns your editing into clear coding analytics: coding time, streaks, goals, projects, languages, and Git activity. Everything stays on your machine, so you can understand your habits without an account, a cloud sync, or telemetry.

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=bistadev.devpulse-code"><strong>Install DevPulse from the VS Code Marketplace</strong></a>
</p>

---

## Dashboard

![DevPulse coding activity dashboard](assets/dashboard.png)

Today's coding time is the largest element on the page, with your current streak and deep work beside it. Daily, weekly, and monthly goals show how close you are to your targets, and the annual banner opens your Developer Wrapped.

## Git and Weekly Analytics

![DevPulse Git activity and weekly coding analytics](assets/git-weekly-analytics.png)

See commits for today, this week, this month, and all time, along with your current branch. Weekly Insights summarize coding time, daily average, best day, favorite day, peak hour, lines, focus sessions, and the projects you worked on.

## Activity and Projects

![DevPulse activity heatmap and project tracking](assets/activity-projects.png)

A six-month heatmap shows your coding consistency, and the weekly bar chart compares each day of the week. Project cards break down hours, days active, files, and top languages per workspace.

## Languages and Overview

![DevPulse language statistics and coding overview](assets/languages-overview.png)

The language breakdown lists your most-used languages with percentages. The overview panel collects lines written today, saves, all-time coding time, and your best streak.

## Share Your Progress

![DevPulse progress sharing options](assets/share-progress.png)

Copy a shareable summary of your coding activity. Choose Professional, Minimal, GitHub, or Wrapped, then paste it wherever you like.

---

## Features

- Automatic background coding time tracking
- Coding streak with current and best streak
- Daily, weekly, and monthly goals
- Project tracking across every workspace folder
- Language statistics with percentages
- Git activity: commits, branch, and recent messages
- Activity heatmap and weekly bar chart
- Weekly Insights: coding time, daily average, best day, favorite day, peak hour, lines, sessions, and projects
- Developer Wrapped with animated stats, top projects, and a six-month heatmap
- Share cards in four templates
- Export all data as JSON
- Works offline

## Privacy

- No account or sign-up
- Data stored locally on your machine
- No telemetry
- Works offline
- Export your data anytime

## Commands

| Command | Description |
|---------|-------------|
| `DevPulse: Show Dashboard` | Open the main dashboard |
| `DevPulse: Open Yearly Wrapped` | View your annual report |
| `DevPulse: Open Monthly Wrapped` | View your monthly report |
| `DevPulse: Copy Share Card` | Generate and copy a shareable card |
| `DevPulse: Export Data` | Export all tracking data as JSON |

## Local Data

DevPulse writes a single JSON file to your VS Code storage directory and never sends it anywhere. Use `DevPulse: Export Data` to save a copy whenever you want.

## License

MIT. See [LICENSE](LICENSE) for details.
