# Changelog

All notable changes to this project will be documented in this file.

## [0.8.1] - 2026-06-18

- Added Matomo custom event tracking for key user actions: search submissions, AI mode toggles, dataset play/source
  clicks, citation open/copy/download, and filter apply/remove.
- Added a "Were these results helpful?" thumbs-up/down feedback widget to the search results page, submitting responses
  as Matomo events.

## [0.8.0] - 2026-06-18

- Rebuilt the Data Sandbox (data player) end-to-end: launch analysis tools and VREs against a dataset through the gRPC
  coordinator, with tool-registry/matchmaker search, file mapping, value and free-text parameters, optional parameters
  surfaced from tool slots, and live task updates streamed over SSE.
- Added file browsing in the Sandbox: file tree view, a file preview modal for text, CSV, PDF and image files, adding
  extra files to a run, and file renaming when sending files to a tool.
- Added a repository statistics feature with API integration and chart visualization (`recharts`).
- Gated the Data Sandbox behind login: the Play button in `SearchResultItem` is always visible but requires sign-in to
  use, matching the existing gating on chat and AI mode.
- Refactored `DataplayerPage` into smaller components and hooks, made gRPC clients singletons, and moved all gRPC calls
  to the server.
- Removed the legacy dataplayer POC UI and the old dispatcher run page.
- Security: added SSRF protection for file previews via URL validation and redirect handling, and applied
  `noopener,noreferrer` to externally opened windows.

## [0.7.4] - 2026-06-11

- Added the EOSC Data Commons Privacy Policy page at `/privacy-policy`.
- Added the EOSC Data Commons Services AUP page at `/acceptable-use-policy`.

## [0.7.3] - 2026-06-08

- Updated default model to `cesnet/qwen3-coder` across all entry points.
- Improved chat message summary logic to avoid truncation.
- Aligned the collapse button to the right in chat messages.
- Added programmatic focus support for the chat input via `chatInputRef`.
- Added EU funding acknowledgment and logo to the Footer component.
- Security: updated `react-router` and all `@react-router/*` packages to 7.17.0, resolving 5 high-severity CVEs
  (RCE via turbo-stream deserialization, open redirect, XSS in RSC redirects, stored XSS in prerendered HTML, DoS via
  manifest endpoint and single-fetch).
- Security: updated `pm2` to 7.0.1 (resolves ReDoS) and overrode `ws` to `^8.21.0` (resolves uninitialized memory
  disclosure in pm2's bundled `ws`).

## [0.7.2] - 2026-06-01

- Added an option to delete a chat conversation in the ChatPage, with a confirmation prompt to prevent accidental
  deletions.
- Refactored user initials logic into the shared `getUserInitials` utility and updated all usages for consistency

## [0.7.0] - 2026-05-22

- Enhanced `SearchInput` with an AI mode toggle (available to authenticated users), sign-in prompt for locked AI mode
- Added ChatPage with chat-style interaction support, including message history
- Updated landing page to render user menu.
- Added repository logo support for `HAL` and `PaNOSC`, and updated the `DABAR` logo in `RepoLogo`.
- Added `.npmrc` policy `in-release-age=3` to prefer package versions at least 3 days old, and documented this behavior
  in `README.md`.

## [0.6.1 -> 0.6.4] - 2026-04 -> 2026-05

- Updated project dependencies and dev dependencies as maintenance updates.

## [0.6.0] - 2026-03-17

- Introduced user authentication with login/logout functionality and user profile menu.
- Updated default search model to `einfracz/qwen3-coder` and added `einfracz/deepseek-v3.2-thinking`.
- Improved error handling for search, including specific UI for rate limiting and server errors.

## [0.5.3] - 2026-02-23

- Updated deployment workflow to only run on `main` branch
- Removed changelog and version bump check on every PR for `main` branch

## [0.5.1] - 2026-02-23

- Updated Docker build and deployment workflow to trigger on version tags and improve image tagging strategy.
- Updated `docker-compose.yml` to use `npm run prod` for the frontend service.

## [0.5.0] - 2026-02-12

- Moved the project from Client Side Rendering (CSR) to Server Side Rendering (SSR) using React Router.

## [0.4.2] - 2025-12-22

- Enhanced search result score badges with informative tooltips

## [0.4.1] - 2025-12-18

- Refactored filter management: filter options now update dynamically based on currently selected filters for more
  accurate and responsive filtering

## [0.4.0] - 2025-12-17

- Added local filtering and aggregation utilities for faster, client-side dataset filtering
- Refactored SearchPage to use new hooks and components, with filter state synced to URL

## [0.3.10] - 2025-12-11

- Updated react-dom and related libraries due to security vulnerabilities
  found. [See details](https://www.heise.de/en/news/Patch-Now-Critical-Malware-Vulnerability-Threatens-React-11102482.html)

## [0.3.9] - 2025-12-05

- Integrated DOI.org API for citation fetching: citations are now retrieved from official DOI metadata when available,
  with local fallback

## [0.3.8] - 2025-12-03

- Updated Dispatcher API endpoint: switched from dev3 to dev1.

## [0.3.7] - 2025-12-01

- Fixed the issue where the "AI is analyzing" message would persist when no search results were found.

## [0.3.6] - 2025-11-28

- Improved favicon handling: ensured favicon is copied to the correct output directory and referenced with a non-hashed
  path for consistent browser support (including Firefox and direct /favicon.ico access).

## [0.3.5] - 2025-11-27

- Fixed favicon not displaying across all browsers and platforms

## [0.3.4] - 2025-11-27

- Minor UI enhancements and interaction improvements on the landing page.

## [0.3.3] - 2025-11-26

- Implemented a standardized timeout mechanism for all backend API calls to improve application reliability and provide
  clearer error messages when services are unresponsive.

## [0.3.2] - 2025-11-25

- Updated terminology throughout the application: replaced "analysis" references with "Virtual Research Environment (
  VRE)" to accurately reflect that the VRE is being prepared to run analyses, not running them directly.

## [0.3.1] - 2025-11-24

- Renamed repository to `EOSC-Data-Commons/matchmaker` and updated all in-app links, Docker image names, and
  documentation to use the new GitHub and GHCR locations.

## [0.3.0] - 2025-11-24

- Integrated EOSC Player Dispatcher, allowing users to run analyses on datasets directly from search results.
- Added `RepoLogo` component to display repository logos in search results for better dataset origin identification.
- Standardized citation export to consistently use the `publication_date` field.
- Updated "Cite" button color to gray for improved UI consistency.
- Fixed the homepage link in the footer to use HTTPS.
- Added API functions, utility helpers, and proxy configuration for dispatcher integration.

## [0.2.1] - 2025-11-13

- Enhanced search results UI: descriptions and author lists are now expandable, and OpenSearch scores for non-AI-ranked
  results are shown with proportional stars and percentages.
- Minor UI improvements in citation export.
- Updated multiple dependencies and devDependencies to the latest versions for improved compatibility and security.
- GitHub issue template configuration updated: blank issues are disabled, and a contact link to Discussions is added for
  questions/help.

## [0.2.0] - 2025-11-07

- Refactored backend search to support SSE streaming and improved error handling.
- Added new search model `einfracz/gpt-oss-120b`.
- Redesigned footer for better responsiveness and added e-INFRA CZ acknowledgement.
- Enhanced dataset search result rendering for accuracy and consistency.
- Upgraded dependencies, including Vite.

## [0.1.1] - 03-11-2025

- Added Matomo analytics tracking for page views and route changes.
- Improved UI throughout the website for better responsiveness and visual clarity.
- Upgraded Vite to version 7.1.12.
- Improved changelog update check workflow in CI.

## [0.1.0] - 17-10-2025
- Improved search experience with keyboard navigation and history dropdown.
- Dismissed disclaimers now stay hidden for your session.
- Updated landing page subtitle for clarity.
- Publication dates now use a consistent format.
- App version is now visible in the footer with a link to the changelog.
- Upgraded core technologies for better performance and stability.
- Various minor fixes and enhancements.
