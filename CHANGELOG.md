# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [1.3.2] - 2026-06-06

### Added
- Comprehensive test coverage for all modules (expanded test suite from 20 to 55 tests)
- Storage module tests covering `getQuotaUsage`, isolated settings, 100KB quota limit rejections, legacy key fallbacks, chunk parse failure recovery, and `localStorage` environment fallbacks
- Hook tests covering `moveEvent` and `updateShowWeekends` callbacks
- Unit tests for new components: `ErrorBoundary`, `ProjectsModal`, and `CustomToolbar`
- Component tests updates for `ProjectItem` (cancel reset, CSS variable color resolution) and `EventModal` (empty/invalid date validations, delete/cancel actions, dynamic project addition)
- Integration tests for the main `App` component checking loading states and projects modal toggles

## [1.3.1] - 2026-06-05

### Fixed
- Fixed extension popup collapsing into a small square by enforcing dimensions

## [1.3.0] - 2026-06-05

### Added
- Project creation functionality to the manage projects modal

### Changed
- Remove calendar week labeling, relax app dimensions, and standardize CSS formatting

### Fixed
- Fixed visual bug where overlapping events would disappear from the calendar view

## [1.2.0] - 2026-05-14

### Added
- Project name label on calendar event cards
- Detailed event hover cards containing descriptions and project labels (replaced native browser tooltips)
- Project management system with dedicated modal and storage support

### Changed
- Clean up App.tsx formatting and moved Projects button to toolbar container
- Weekend styling class to calendar date headers to support weekend hiding functionality

### Documentation
- Comprehensive README.md with project overview, features, and setup instructions

## [1.1.0] - 2026-05-14

### Added
- Weekend visibility toggle and storage persistence for calendar view settings
- Locale-aware date formatting and configured user-specific calendar start days
- Custom date header to month view with daily duration totals and event tags
- Calendar month view with navigation and drill-down functionality
- Extension icons, release script, and improved storage serialization
- Duration display to calendar events and daily headers
- Initial time tracker extension project with React and Big Calendar integration

### Changed
- Theme-based color variables, configured custom calendar formats, and added workday slot highlighting
