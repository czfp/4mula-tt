# Tuklas Talino

Refactored from a single-file prototype into a cleaner multi-file structure while preserving the original front-end demo behavior.

## Entry Point
- `index.html` - main application shell with screen markup only
- `index.single-file.backup.html` - original all-in-one reference copy

## Styles
- `assets/css/style.css` - base layout, screens, forms, tables, modals, navigation
- `gamification/gamification.css` - XP, badge, progress, and reward-related UI styles

## JavaScript Modules
- `data/students.js` - demo seed data and lesson library
- `assets/js/core.js` - storage, migration, session state, auth, navigation, shared utilities
- `gamification/gamification.js` - XP, levels, badges, and scoring helpers
- `adaptive-ui/grade-ui.js` - grade-aware student dashboard rendering
- `assets/js/student.js` - student lesson flow, groups, profile, speech, and writing
- `assets/js/teacher.js` - teacher dashboard, groups, tasks, lessons, exports
- `assets/js/admin.js` - admin maintenance, history, and account controls
- `assets/js/app.js` - bootstrap and service worker registration

## Supporting Files
- `manifest.json` - minimal web app manifest
- `sw.js` - minimal service worker shell cache
- `components/dashboard.html` - reference template for future dashboard component extraction

## Notes
- Inline CSS and inline JavaScript were removed from `index.html`.
- The duplicate `adminReactivateTeacher` function was consolidated.
- This is still a front-end/localStorage prototype, but the structure is now much easier to grow.
