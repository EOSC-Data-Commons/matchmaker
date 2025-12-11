# Changelog

All notable changes to this project will be documented in this file.

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
