# Reset Tracker

Reset Tracker is a modern, offline-first Progressive Web App (PWA) designed to track personal journeys and streaks with a focus on long-term progress rather than perfection. Unlike traditional streak trackers that demand a hard reset upon a lapse, Reset Tracker computes a overarching **Success Rate**, encouraging users to maintain consistency, learn from mistakes, and recover quickly.

## Features

- **Success Rate Tracking:** Tracks your journey mathematically by calculating a success percentage (`successful days / total days`). A slip-up doesn't erase your entire history.
- **Dynamic Visualizations:** Features a vibrant, interactive SVG progress ring and a dynamic wave animation that visibly represents your ongoing progress towards stability.
- **Tiered Goals & Stable Recovery:** Actively provides target percentage goals. Reach and maintain a 98%+ success rate for 6 months to unlock the "Stable Recovery" status, complete with unique bright thematic UI visuals.
- **Offline-First PWA:** Implements a Service Worker (`sw.js`) that caches all core application files, allowing it to work entirely offline. Installable to your mobile device's home screen.
- **Data Privacy & Management:** 100% client-side. All progress data is strictly stored locally using `localStorage`. Includes built-in tools to easily Export and Import your JSON data for backups.

## Setup & Running Locally

Since Reset Tracker is a pure static web app (HTML, CSS, JS text files), no external dependencies or build tools are required:

1. Clone or download the repository.
2. Serve the directory via a local development server (necessary for the Service Worker to register securely on `localhost`).
   - *Using Python:* `python -m http.server 8000`
   - *Using Node.js:* `npx serve .`
   - *Using PHP:* `php -S localhost:8000`
3. Navigate to `http://localhost:8000` in your browser.

**To install as a PWA on mobile/desktop:**
- Open the application in a supported modern browser (Chrome, Edge, Safari).
- Select the **Install App** icon in the URL bar, or tap **Add to Home Screen** from the browser's sharing/options menu.

## Project Structure

- `index.html`: The main markup structure and application UI.
- `app.js`: Core logic incorporating all state management, date/streak logic, SVG animations, and settings menu interactions.
- `style.css`: All styling, layouts, custom variables, and responsive design queries.
- `sw.js`: The Service Worker handling the robust offline-first caching of assets.
- `manifest.json` & `icon.svg`: App metadata and iconography specifically for PWA installation functionality.

## How it Works

1. **Start Date:** Set the day your journey originally began in the Settings modal.
2. **Log a Lapse:** Use the prominent main action button to record a slip-up. The app adjusts your timeline rate but preserves all earlier solid progress.
3. **The Wave:** Try to push your score past 98%. Earning back high momentum will start visually filling a liquid wave in the center display over a 6 month period.
4. **Maintenance:** You can manually insert forgotten past lapses in Settings or do a full data export to carry your stats to another device.
