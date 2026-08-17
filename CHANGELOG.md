# Changelog

All notable changes to this project will be documented in this file.

## [0.10.1] - 17/08/2026

File previews work again, and the chat is usable on a phone:

- Fixed file previews failing with "Preview not available, download the file instead" for files that were perfectly
  previewable. Before opening a file, the server checked its download URL against a list it kept in memory, but the
  deployment runs several worker processes, so the worker handling the preview usually had no record of a URL the worker
  that listed the files had seen. Download URLs are now signed instead, which any worker can verify.
- Fixed image and PDF previews being sent to the browser with a doubled content type (Zenodo sends the header twice),
  which no viewer recognises. The PDF viewer in particular refuses to open a document labelled that way.
- Preview problems now explain themselves rather than sharing one message: a preview link that has gone stale asks you
  to reload the page, and previewing many files in quick succession asks you to wait a moment.
- The preview (eye) icon no longer appears on files the server would turn down anyway.
- The chat conversation list is now a drawer on phones and small screens, opened from a button in the header and closed
  by picking a conversation, tapping outside it, or pressing Escape. On wider screens it stays where it was.
- The per-conversation options button is now visible on touch screens, where there is no hover to reveal it.
- The search field no longer cuts its placeholder off mid-phrase on a narrow screen: it shows a shorter prompt instead (
  "Search for data...", or "Ask about datasets..." in AI Mode).
- Headings, message spacing and the "Were these results helpful?" row now fit narrow screens instead of overflowing.

For deployment: preview requests are limited to 100 per minute per IP address. If the frontend sits behind a reverse
proxy, set Express's `trust proxy` to match your topology, otherwise that limit is shared by everyone rather than
applied per user. The preview proxy also refuses URLs whose hostname resolves to a private, loopback or link-local
address, rechecked on every redirect hop, so a dataset pointing at an internal service cannot be used to reach it. Set
`PREVIEW_URL_SECRET` (any random 32+ byte string) only if the frontend runs as more than one container: workers inside a
single container agree on a key by themselves. Dependencies: `express-rate-limit` added, `nanoid` moved from 3.3.17 to
3.3.18, and the unused `@mjackson/node-fetch-server` dropped.

## [0.10.0] - 14/08/2026

Searching and asking the AI are now two separate things, so a plain search no longer waits on the AI:

- Plain search is much faster. The results page goes straight to the index instead of starting an AI run and waiting for
  it to search on your behalf, and the results you get are the same ones the AI would have found.
- Added an **AI Mode** button in the search bar. Switch it on and your question opens a chat; leave it off and you get
  the plain list of results. It starts on from the home page and off on the results page.
- Clicking **AI Mode** while signed out now takes you through sign in and back to your query, instead of being greyed
  out and doing nothing.
- The search bar is now a single bar holding the query, a clear button, **AI Mode** and search, and the query can be
  cleared without selecting the text first.
- The AI summary box has been removed from the results page. AI answers now live in the chat, where you can ask a
  follow-up question about them.
- Results now carry one relevance score instead of two competing ones. The tooltip explains it is for comparing results
  in this list against each other, rather than a mark out of 100 for how good a dataset is.
- The chat now shows its work. Each search or lookup it ran appears as a line you can expand ("Searched datasets",
  "Searched tools", "Listed dataset files") to see what it found, with software tools and dataset files laid out
  properly instead of as raw data.
- Datasets mentioned in an AI answer are now clickable: hover or click one to see its full details without leaving the
  answer.
- Long AI answers are no longer cut off part way through, and scrolling up to re-read something no longer drags you back
  to the bottom.
- The chat no longer apologises for errors that never happened, which it did when an earlier error message was carried
  back into the conversation.
- The results page now says "Showing the 30 most relevant datasets" rather than "Found 30 datasets", which suggested
  that was everything there was to find.
- Fixed datasets from Zenodo with no publication date failing to load.

For deployment: plain search needs a backend exposing `GET /api/search/search`. LLM reranking has been removed, the
streaming code now uses `@microsoft/fetch-event-source` instead of a hand-rolled parser, and the coordinator gRPC target
is set in one place (`GRPC_TARGET`, defaulting to the hosted coordinator in production and a local one in development).

## [0.9.8] - 07/08/2026

- Fixed the npm supply-chain guard being inert: `.npmrc` set `in-release-age=3` where npm reads `min-release-age`, so
  the intended 3 day quarantine on freshly published packages was silently ignored on every install since it was added.
- Upgraded React Router from 7.17 to 8.3 (`react-router`, `@react-router/dev`, `express`, `fs-routes`, `node` and
  `serve`), and React from 19.2.4 to 19.2.7.
- Added a `preversion` script that fetches `origin/main` and aborts the bump when HEAD is behind it, so a release tag
  can no longer be cut on stale code and published as if it were current.
- The repository statistics chart now shows each repository the way the project spells its own name (`ONE` as Onedata,
  `PANOSC` as PaNOSC, `DATAVERSELV` as DataverseLV, `FINBIF` as FinBIF) rather than the backend's upstream short code.
  Codes not on that list still fall through to whatever the backend sends.
- Renamed "Dataverse Latvia" to "DataverseLV" in the search result provenance labels, matching the name the repository
  uses at dataverse.lv.
- The chat empty state now reads "Welcome to the EOSC Data Commons Chat" instead of "Welcome to EOSC Chat".

## [0.9.7] - 21/07/2026

These four changes were previously listed under 0.9.6, which was tagged before the branch carrying them was merged:

- Search results now show repository provenance logos: records aggregated through a crawler platform (currently OneData,
  with OpenAIRE and OpenAlex support built in) display both the owning repository and the aggregator that harvested it,
  instead of only the aggregator's logo, which made harvested data look as though it had been deposited there directly.
  Records harvested directly from a repository (DANS, HAL, Zenodo, etc.) keep a single source-repository logo.
- Tool launch failures are no longer silent: a failed launch now stays on the monitoring step and shows the actual error
  message, instead of bouncing back to the configuration step, which unmounted the only place the error was rendered.
  Added a "Back to configuration" button alongside "Start Over" on launch failure. Raw backend/gRPC error text (e.g. "5
  NOT_FOUND: ...") is now replaced with a plain
  "No tools matched - try a different search term" message.
- Fixed citation exports (BibTeX, RIS, EndNote, CSL-JSON, RefWorks) showing "1970" as the publication year for datasets
  with a missing or unparseable date; they now correctly fall back to "n.d.", or to the dataset's `publicationYear`
  field when available.
- Chat and search failures caused by a backend timeout now surface the backend's actual error message instead of the
  stream silently ending and leaving the chat stuck on its loading spinner.
- Updated `systeminformation` from 5.31.6 to 5.33.0.

## [0.9.6] - 20/07/2026

- Updated `morgan` from 1.10.1 to 1.11.0. This tag carries no other changes: the work described in the original 0.9.6
  entry is now listed under 0.9.7 above, where it actually shipped.

## [0.9.5] - 06/07/2026

Release 1 feedback fixes for the dataplayer, tool selection, and AI chat (all frontend):

- The dataplayer file tree now starts collapsed beyond the top level, pages long lists of children behind a "show more"
  control, and caps indentation depth, so large datasets no longer flood the screen.
- Added **Remove** on each additional dataset and a **Reset all** control, so the list of added file groups can be
  cleared instead of only ever growing.
- Removed the "Back to Search Results" button, which navigated to a fresh empty search when the dataplayer was opened in
  a new tab.
- File preview now renders proxy errors as a "preview not available - download instead" message rather than dumping the
  raw `{"error":...}` payload into the preview body, and falls back gracefully when an image fails to load.
- The map-files step now has explicit loading, error, and loaded states with a 15s timeout and a retry/back path, so it
  can no longer hang forever on empty or bad tool config. Tools with no parameters now show a "this tool needs no
  parameters — click Submit to VRE" message instead of empty input boxes.
- Tool descriptions are stripped of raw Markdown and line-clamped, so cards stay compact and readable.
- The tool list empty state now offers starter suggestion chips (`jupyter`, `notebook`, `python`) plus a loading
  indicator, and surfaces an error message when a tool search fails instead of silently showing "No tools found."
- The AI chat now renders an in-chat error bubble (including a friendly "the search timed out" message) when the chat
  stream fails, instead of dead-ending silently after the user's message.

## [0.9.4] - 02/07/2026

- Task launches no longer fail when the EGI Secret Store is unreachable (e.g. dev environments, which only have the
  Secret Store provisioned in production) — the API-key lookup now degrades gracefully and launches the task without
  keys instead of returning a 500.

## [0.9.3] - 02/07/2026

- Added per-user API key support for tool launches: matchmaker now reads a user's stored VIP and GitHub keys from the
  EGI Secret Store and forwards them to the coordinator so tools can authenticate on the user's behalf.

## [0.9.2] - 02/07/2026

- Fixed the whole site returning HTTP 500 in deployments (v0.9.0 and v0.9.1) on Node runtimes without the `sessionStorage`
  global (e.g. the `node:24-alpine` container image): the alpha disclaimer read `sessionStorage` in its `useState`
  initializer, which runs during server-side rendering and crashed every request with
  `ReferenceError: sessionStorage is not defined`. The read is back in a client-only effect.
- Reverted the recent-searches panel to reading search history after hydration, avoiding a server/client hydration
  mismatch when history exists.

## [0.9.1] - 02/07/2026

- Added explicit least-privilege `permissions: contents: read` blocks to the Test, Build, and Dependency Audit GitHub
  Actions workflows, resolving the CodeQL "missing workflow permissions" warning.
- The Test workflow still blocks PRs on failing tests but no longer enforces coverage thresholds; it now runs the plain
  test suite instead of `test:coverage`.
- Removed the tests for the post-play dataplayer flow (coordinator API, dataplayer hooks, and file preview parsing),
  as everything downstream of the Play button is owned by the coordinator backend.

## [0.9.0] - 02/07/2026

- Added an automated test suite (Vitest + React Testing Library + MSW): 221 tests covering the citation generators,
  local filters and shared utilities, the SSE search/chat API layer, the Secret Store API-key client, the coordinator
  API, the data/auth/search hooks, and interaction tests for the search input, filter panel, citation export,
  pagination, and user menus. Coverage gates enforce 80% line coverage on `src/lib` and 70% on `src/hooks`.
- Added a blocking "Test" GitHub Actions workflow for PRs to main, running typechecking and the test suite with
  coverage thresholds.
- Fixed citation generation crashing for datasets that list no creators — BibTeX, RIS, and CSL-JSON exports now omit
  the author field instead of throwing.
- Fixed every successful chat message being internally reported as a "No search results received" error, which
  cluttered the console and made real chat failures indistinguishable from the false alarm.

## [0.8.9] - 01/07/2026

- Updated the default model to `cesnet/agentic` across components and API calls.
- Switched to the `en-GB` locale for consistent number formatting across components.

## [0.8.8] - 30/06/2026

- Fixed the search results page showing a red "Search Error / No search results received" panel when a query returned no
  datasets (e.g. when the backend answered conversationally instead of returning results).

## [0.8.7] - 26/06/2026

- Added updated more in-depth stats on the landing page.

## [0.8.6] - 26/06/2026

- Fixed a bug where starting a new chat from the landing page did not update the conversation sidebar or chat title
  until a hard refresh.
- Capped the number of files sent to the tool-registry match API at 10 and added a warning log when the list is
  truncated, preventing oversized payloads.

## [0.8.5] - 24/06/2026

- Fixed the Data Sandbox showing a usable page with misleading "failed to fetch files" / "no tools found" errors when
  opened while logged out (e.g. via a shared dataset link)
- Added return-to-page after login: signing in from a gated page (Sandbox, chat, or profile) now returns the user to
  the page they came from instead of dropping them on the landing page.

## [0.8.4] - 23/06/2026

- Data Sandbox tool/VRE launches now pass richer context to the coordinator

## [0.8.3] - 19/06/2026

- Added a user profile page at `/profile` for managing per-user API keys, stored in the EGI Secret Store and reached
  through the cookie-authenticated `/auth/keys` API. Keys can be set, replaced, revealed, and removed, with per-key
  configured status. Surfaced via an "API Keys" entry in the user menu.
- Fixed the Sandbox file list to show "Unknown size" instead of "0 B" for files with no reported size, and to hide the
  preview action for those files.

## [0.8.2] - 18/06/2026

- Fixed the production server failing to start in the container (`ERR_MODULE_NOT_FOUND` for the gRPC client): the server
  entry is now bundled with `esbuild` into a single self-contained `build/server.js` instead of being emitted by `tsc`,
  which left native-ESM relative imports without the required `.js` extensions. Added `esbuild` as a dev dependency.

## [0.8.1] - 18/06/2026

- Added Matomo custom event tracking for key user actions: search submissions, AI mode toggles, dataset play/source
  clicks, citation open/copy/download, and filter apply/remove.
- Added a "Were these results helpful?" thumbs-up/down feedback widget to the search results page, submitting responses
  as Matomo events.

## [0.8.0] - 18/06/2026

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

## [0.7.4] - 11/06/2026

- Added the EOSC Data Commons Privacy Policy page at `/privacy-policy`.
- Added the EOSC Data Commons Services AUP page at `/acceptable-use-policy`.

## [0.7.3] - 08/06/2026

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

## [0.7.2] - 01/06/2026

- Added an option to delete a chat conversation in the ChatPage, with a confirmation prompt to prevent accidental
  deletions.
- Refactored user initials logic into the shared `getUserInitials` utility and updated all usages for consistency

## [0.7.0] - 22/05/2026

- Enhanced `SearchInput` with an AI mode toggle (available to authenticated users), sign-in prompt for locked AI mode
- Added ChatPage with chat-style interaction support, including message history
- Updated landing page to render user menu.
- Added repository logo support for `HAL` and `PaNOSC`, and updated the `DABAR` logo in `RepoLogo`.
- Added `.npmrc` policy `in-release-age=3` to prefer package versions at least 3 days old, and documented this behavior
  in `README.md`.

## [0.6.1 -> 0.6.4] - 04/2026 -> 05/2026

- Updated project dependencies and dev dependencies as maintenance updates.

## [0.6.0] - 17/03/2026

- Introduced user authentication with login/logout functionality and user profile menu.
- Updated default search model to `einfracz/qwen3-coder` and added `einfracz/deepseek-v3.2-thinking`.
- Improved error handling for search, including specific UI for rate limiting and server errors.

## [0.5.3] - 23/02/2026

- Updated deployment workflow to only run on `main` branch
- Removed changelog and version bump check on every PR for `main` branch

## [0.5.1] - 23/02/2026

- Updated Docker build and deployment workflow to trigger on version tags and improve image tagging strategy.
- Updated `docker-compose.yml` to use `npm run prod` for the frontend service.

## [0.5.0] - 12/02/2026

- Moved the project from Client Side Rendering (CSR) to Server Side Rendering (SSR) using React Router.

## [0.4.2] - 22/12/2025

- Enhanced search result score badges with informative tooltips

## [0.4.1] - 18/12/2025

- Refactored filter management: filter options now update dynamically based on currently selected filters for more
  accurate and responsive filtering

## [0.4.0] - 17/12/2025

- Added local filtering and aggregation utilities for faster, client-side dataset filtering
- Refactored SearchPage to use new hooks and components, with filter state synced to URL

## [0.3.10] - 11/12/2025

- Updated react-dom and related libraries due to security vulnerabilities
  found. [See details](https://www.heise.de/en/news/Patch-Now-Critical-Malware-Vulnerability-Threatens-React-11102482.html)

## [0.3.9] - 05/12/2025

- Integrated DOI.org API for citation fetching: citations are now retrieved from official DOI metadata when available,
  with local fallback

## [0.3.8] - 03/12/2025

- Updated Dispatcher API endpoint: switched from dev3 to dev1.

## [0.3.7] - 01/12/2025

- Fixed the issue where the "AI is analyzing" message would persist when no search results were found.

## [0.3.6] - 28/11/2025

- Improved favicon handling: ensured favicon is copied to the correct output directory and referenced with a non-hashed
  path for consistent browser support (including Firefox and direct /favicon.ico access).

## [0.3.5] - 27/11/2025

- Fixed favicon not displaying across all browsers and platforms

## [0.3.4] - 27/11/2025

- Minor UI enhancements and interaction improvements on the landing page.

## [0.3.3] - 26/11/2025

- Implemented a standardized timeout mechanism for all backend API calls to improve application reliability and provide
  clearer error messages when services are unresponsive.

## [0.3.2] - 25/11/2025

- Updated terminology throughout the application: replaced "analysis" references with "Virtual Research Environment (
  VRE)" to accurately reflect that the VRE is being prepared to run analyses, not running them directly.

## [0.3.1] - 24/11/2025

- Renamed repository to `EOSC-Data-Commons/matchmaker` and updated all in-app links, Docker image names, and
  documentation to use the new GitHub and GHCR locations.

## [0.3.0] - 24/11/2025

- Integrated EOSC Player Dispatcher, allowing users to run analyses on datasets directly from search results.
- Added `RepoLogo` component to display repository logos in search results for better dataset origin identification.
- Standardized citation export to consistently use the `publication_date` field.
- Updated "Cite" button color to gray for improved UI consistency.
- Fixed the homepage link in the footer to use HTTPS.
- Added API functions, utility helpers, and proxy configuration for dispatcher integration.

## [0.2.1] - 13/11/2025

- Enhanced search results UI: descriptions and author lists are now expandable, and OpenSearch scores for non-AI-ranked
  results are shown with proportional stars and percentages.
- Minor UI improvements in citation export.
- Updated multiple dependencies and devDependencies to the latest versions for improved compatibility and security.
- GitHub issue template configuration updated: blank issues are disabled, and a contact link to Discussions is added for
  questions/help.

## [0.2.0] - 07/11/2025

- Refactored backend search to support SSE streaming and improved error handling.
- Added new search model `einfracz/gpt-oss-120b`.
- Redesigned footer for better responsiveness and added e-INFRA CZ acknowledgement.
- Enhanced dataset search result rendering for accuracy and consistency.
- Upgraded dependencies, including Vite.

## [0.1.1] - 03/11/2025

- Added Matomo analytics tracking for page views and route changes.
- Improved UI throughout the website for better responsiveness and visual clarity.
- Upgraded Vite to version 7.1.12.
- Improved changelog update check workflow in CI.

## [0.1.0] - 17/10/2025

- Improved search experience with keyboard navigation and history dropdown.
- Dismissed disclaimers now stay hidden for your session.
- Updated landing page subtitle for clarity.
- Publication dates now use a consistent format.
- App version is now visible in the footer with a link to the changelog.
- Upgraded core technologies for better performance and stability.
- Various minor fixes and enhancements.
