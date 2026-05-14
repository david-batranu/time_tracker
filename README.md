# Time Tracker Extension

A modern, high-performance Chrome extension for daily time tracking. Built with React, TypeScript, and Vite, it provides a seamless calendar-based interface for managing your tasks and projects.

## Features

- **Interactive Calendar**: Drag-and-drop weekly agenda view and a condensed month overview.
- **Project Management**: Organize events by project with custom colors and labels.
- **Rich Event Editing**: Modal-based editing for titles, durations, project assignments, and detailed descriptions.
- **Premium Aesthetics**: Clean, modern design with custom tooltips, project pills, and smooth transitions.
- **Smart Weekend Toggle**: Easily hide or show weekends to focus on your work week.
- **Persistence**: Synchronizes data across devices using `chrome.storage.sync` with a local fallback.
- **Safety Checks**: Prevents deletion of projects that have active events assigned to them.

## Tech Stack

- **Framework**: React 18
- **Language**: TypeScript
- **Bundler**: Vite
- **Calendar**: React Big Calendar
- **Icons**: Lucide React
- **Date Handling**: Moment.js

## Getting Started

### Development

1. Clone the repository:
   ```bash
   git clone git@github.com:david-batranu/time_tracker.git
   cd time_tracker
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Building for Chrome

1. Build the production bundle:
   ```bash
   npm run build
   ```

2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the `dist` directory in this project.

## License

MIT
