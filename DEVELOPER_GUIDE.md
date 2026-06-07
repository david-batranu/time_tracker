# Developer Guide: Time Tracker Extension

This guide provides technical details for developers working on the Time Tracker project.

## Project Overview

Time Tracker is a high-performance Chrome extension designed for daily time management. It allows users to track tasks across various projects using an interactive calendar-based interface.

Key characteristics:
- **Persistence**: Data is synced across devices via `chrome.storage.sync`.
- **Efficiency**: Uses a custom chunking system to manage storage limits.
- **UX**: Focuses on smooth interactions, modal-driven editing, and a clean aesthetics.

## Tech Stack

- **Frontend**: React 18, TypeScript
- **Build Tooling**: Vite, Vitest (testing), Rollup
- **Key Libraries**:
    - `react-big-calendar`: For the main agenda and month views.
    - `moment.js`: For date manipulation and formatting.
    - `lucide-react`: For iconography.
    - `chrome.storage`: Native browser storage API.

## Project Structure

```text
.
├── public/              # Static assets (icons, manifest)
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── CustomToolbar.tsx    # Top-level navigation and actions
│   │   ├── ErrorBoundary.tsx    # Global error handling
│   │   ├── EventModal.tsx        # Create/Edit modal for time entries
│   │   ├── ProjectItem.tsx        # UI element for projects
│   │   └── ProjectsModal.tsx      # Project management view
│   ├── hooks/           # Custom React hooks
│   │   ├── useCalendarEvents.ts  # Logic for fetching/filtering events
│   │   └── useProjects.ts        # Logic for project CRUD
│   ├── styles/          # CSS Modules/Global styles
│   │   ├── base.css      # Reset and global styles
│   │   ├── calendar.css  # Specific to React Big Calendar
│   │   ├── modals.css    # Modal styling
│   │   ├── tooltip.css  # Tooltip styling
│   │   └── variables.css # Design tokens (colors, spacing)
│   ├── main.tsx         # Application entry point
│   ├── storage.ts       # Storage abstraction layer
│   ├── types.ts         # TypeScript interfaces and constants
│   └── test/            # Unit and integration tests
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Core Concepts

### 1. Data Modeling (`src/types.ts`)
The application relies on three primary entities:
- **Project**: A collection of tasks, defined by a title and a specific color.
- **TimeEntry**: A single unit of work with a title, duration, start/end dates, and an optional project ID.
- **Settings**: User preferences (e.g., `showWeekends`).

### 2. Storage & Quota Management (`src/storage.ts`)
Because `chrome.storage.sync` has a strict 100KB quota, the application implements a custom chunking strategy for `timeEntries`.

- **Chunking Logic**: Instead of storing one large array, `timeEntries` are split into smaller chunks (approx. 6KB each) and stored under keys like `te_chunk_0`, `te_chunk_1`, etc.
- **Debouncing**: Storage writes are debounced (500ms) to prevent excessive API calls and potential race conditions during rapid user input.
- **Fallback**: The storage layer automatically falls back to `localStorage` if the `chrome` API is unavailable (e.g., in a standard web environment).

### 3. Styling
The project uses standard CSS files. Design tokens (colors, etc.) are centralized in `src/styles/variables.css`.

## Development Workflow

### Installation
```bash
npm install
```

### Running the App
To start the development server:
```bash
npm run dev
```

### Running Tests
To run the test suite:
```bash
npm run test
```

### Building for Production
To generate the production bundle for the Chrome extension:
```bash
npm run build
```
The production files are located in the `dist/` directory.

## Deployment
To load the extension into Chrome:
1. Go to `chrome://extensions/`
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `dist` folder.
