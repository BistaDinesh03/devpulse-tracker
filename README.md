# ⚡ DevPulse - Proof of Work Tracker

Beautiful, automatic coding activity tracker for VS Code. Track your coding journey, earn achievements, and share your progress with stunning visualizations.

![DevPulse Dashboard](assets/dashboard.png)

## ✨ Features

### 📊 Automatic Activity Tracking
- **Keystroke Analytics**: Tracks every character typed vs pasted
- **Smart Idle Detection**: Automatically pauses when you're away
- **Error Resolution**: Counts bugs squashed from VS Code diagnostics
- **Focus Sessions**: Detects 25+ minute coding streaks
- **File Activity**: Monitors files created, modified, and saved

### 🎨 Beautiful Visualizations
- **Activity Heatmap**: 52-week GitHub-style contribution grid with enhanced design
- **Progress Ring**: Animated daily coding time visualization
- **Weekly Reports**: Bar charts showing your weekly productivity
- **Real-time Updates**: Smooth animations as you code

### 🏆 Achievement System
- **10+ Achievements**: From "Night Owl" to "Bug Centurion"
- **Confetti Celebrations**: Animated celebrations on unlock
- **Rare Achievements**: Special golden achievements for exceptional feats
- **Progress Tracking**: See your progress toward each achievement

### 📸 Share Card Generator
- **One-Click Sharing**: Generate beautiful shareable images
- **Professional Design**: Minimal dark theme perfect for social media
- **Key Stats**: Hours coded, lines written, bugs fixed, streaks
- **Twitter/LinkedIn Ready**: 1200×630px format

## 🚀 Quick Start

1. Install DevPulse from VS Code Marketplace
2. Start coding! Tracking begins automatically
3. Click the flame icon in the status bar to view your dashboard
4. Use `Cmd/Ctrl + Shift + P` and type "DevPulse" to access commands

## ⌨️ Commands

- `DevPulse: Show Dashboard` - Opens the beautiful dashboard
- `DevPulse: Generate Share Card` - Creates a shareable card
- `DevPulse: Export Data` - Export your tracking data
- `DevPulse: Import Data` - Import previously exported data
- `DevPulse: Toggle Tracking` - Pause/resume activity tracking

## 🎯 Achievements

| Achievement | Description | Icon |
|------------|-------------|------|
| Night Owl | Code after midnight | 🦉 |
| Bug Slayer | Fix 10 bugs in a day | ⚔️ |
| Marathon | 4+ hour coding streak | 🏃 |
| Century | 1000+ lines in a day | 💯 |
| Early Bird | Code before 6 AM | 🌅 |
| 7 Day Streak | Code every day for a week | 🔥 |
| Bug Centurion | Fix 100 total bugs | 🛡️ |
| Polyglot | 5+ languages in a day | 🌍 |

## 🔒 Privacy First

- **100% Local**: All data stays on your machine
- **No Accounts**: No sign-up required
- **No Analytics**: We don't collect any data
- **Offline First**: Works completely offline
- **You Own Your Data**: Export anytime

## ⚙️ Configuration

```json
{
  "devpulse.idleTimeout": 120,
  "devpulse.focusSessionMin": 25,
  "devpulse.showStatusBar": true,
  "devpulse.dataRetentionDays": 365
}
📦 Installation
From VS Code Marketplace
Open VS Code

Go to Extensions (Cmd/Ctrl+Shift+X)

Search for "DevPulse"

Click Install

Manual Installation
Download the .vsix file from releases

In VS Code, go to Extensions

Click "..." → "Install from VSIX"

Select the downloaded file

🛠️ Development
bash
# Clone the repository
git clone https://github.com/devpulse/vscode-extension

# Install dependencies
npm install

# Build the extension
npm run compile

# Package the extension
npm run package
📄 License
MIT License - see LICENSE for details

Built with ❤️ for developers who want to visualize their coding journey