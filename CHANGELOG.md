# Changelog

All notable changes to this project will be documented in this file.

## [0.13.1] - 29/10/2026

- The relevance badge is back to a star and a percentage, without the "Relevance" label.

## [0.13.0] - 29/10/2026

- Added Export to AI Mode conversations: save a conversation as a Markdown file, or as a PDF from a printable page.
- An export holds every question and answer, each search with the terms used, and the datasets each answer cites.
- Your name is left out of an export unless you tick "Add my name".

## [0.12.0] - 28/10/2026

- Added a FAIR assessment card to the Data Sandbox, scoring a dataset with F-UJI and FAIR Champion side by side.
- Lists all 15 FAIR criteria, quoted from the FAIR principles, with a plain-language reading of each.
- Shows every check the assessors ran, with an optional filter for checks that did not pass.
- Each score shows how many criteria it is based on; unmeasured criteria read "not assessed", not 0%.
- Shows when the assessment ran, the assessor versions, and a link to the full assessor output.
- Reuses an earlier assessment when there is one; a new one runs only on "Check FAIR score" or "Re-check".
- Datasets without a DOI are assessed by F-UJI only.
- Uses the hosted FAIR assessment service, proxied through the app's own server.

## [0.11.2] - 27/10/2026

- AI Mode is on by default on the home page for signed-in users.
- Signing in from the AI Mode button now returns you with AI Mode on.
- Renamed "Chat" to AI Mode, and chats to conversations.
- Added "Your conversations" to the home page and user menu; the search and AI Mode pages now have the user menu.
- The relevance badge now shows the score results are sorted by, and is hidden when there is none.
- A sent question stays at the top while its answer is written below, with a live indicator on the scroll button.
- Login now goes straight to EGI Check-in, skipping the EOSC federation chooser.
- Removed the alpha notice from the home and search pages.
- Mobile fixes for the search bar, placeholders, "Your conversations" button and Cite button.
- Updated `vitest`, `@vitest/coverage-v8` and `happy-dom` (development only).

## [0.11.1] - 12/10/2026

- Added "Add All Files" to the Dataplayer file selection step.
- Removed the "Rename file..." field; files keep their original names.
- Updated the `req-packager` submodule.

## [0.11.0] - 08/10/2026

- An answer still being written now keeps going when you start a new chat or switch conversations, and stays in its
  own conversation.
- The conversation list shows a spinner for a running answer and a dot for one that finished while you were away.
- The send button becomes Stop while an answer is being written, and the browser asks before you leave mid-answer.
- The copy button is now always visible, and answers have one too.
- Cite now offers formatted citations in APA (default), Chicago, Harvard, MLA and Vancouver, next to BibTeX, RIS and
  CSL JSON.
- Fixed the Cite panel being cut off inside the "Datasets cited in this answer" list.
- Added the NFDI4Earth logo and fixed the DataverseLV logo not loading.
- Removed the placeholder stats line from the home page.
- Added `@radix-ui/react-popover`, and overrides for `basic-ftp` and pm2's `chokidar`.

## [0.10.6] - 11/09/2026

- Tables in AI answers now render as tables.
- Italics, `code` and headings no longer show their Markdown markers.

## [0.10.5] - 10/09/2026

- Fixed repositories and their logos.

## [0.10.4] - 09/09/2026

- A cited dataset is now one pill that jumps to its entry in the "Datasets cited in this answer" list.
- The dataset's page still opens with Ctrl/Cmd+click, middle click or "Open link in new tab".
- Matomo: added `citation_clicked`, removed `citation_marker_clicked`.
- Fixed an open citation carrying over into the next conversation.
- Added a copy button to your own messages.
- Opening a conversation now starts at its latest message.

## [0.10.3] - 08/09/2026

- Datasets in AI answers are now cited with numbers ([1], [2]...) and links that name the repository.
- Added a "Datasets cited in this answer" list under each answer, with Play, Source and Cite buttons.
- Added a "Cited from" line showing which repositories the cited datasets come from.
- The list fills in while the answer streams, and numbers never change once assigned.
- Matomo records clicks on cited datasets and their numbers.

## [0.10.1] - 17/08/2026

- Fixed file previews failing with "Preview not available" when the server runs several workers.
- Fixed image and PDF previews failing because of a doubled content type from Zenodo.
- Preview errors now say what to do (reload the page, or wait a moment).
- The preview icon is hidden on files that cannot be previewed.
- On phones, the conversation list is a drawer and conversation options are always visible.
- Shorter search placeholders and better spacing on narrow screens.
- File previews are limited to 100 requests per minute per IP, and private addresses are refused.
- Deployment: set `trust proxy` behind a reverse proxy, and `PREVIEW_URL_SECRET` when running several containers.
- Added `express-rate-limit`, updated `nanoid` to 3.3.18, removed `@mjackson/node-fetch-server`.

## [0.10.0] - 14/08/2026

- Plain search is much faster: it queries the index directly instead of going through the AI.
- Added an AI Mode button to the search bar; with it on, your question opens a chat.
- Clicking AI Mode while signed out takes you through sign-in and back to your query.
- The search bar is now a single bar with a clear button.
- Removed the AI summary box from the results page; AI answers now live in the chat.
- Results now have a single relevance score.
- The chat shows each search or lookup it ran, expandable to see what it found.
- Datasets mentioned in AI answers can be clicked for their full details.
- Fixed long AI answers being cut off, scrolling jumping to the bottom, and the chat apologising for no reason.
- The results page now says "Showing the 30 most relevant datasets".
- Fixed Zenodo datasets with no publication date failing to load.
- Removed LLM reranking; streaming now uses `@microsoft/fetch-event-source`.
- Deployment: needs a backend with `GET /api/search/search`; the coordinator is set with `GRPC_TARGET`.

## [0.9.8] - 07/08/2026

- Fixed the `.npmrc` package age guard (`min-release-age`), which had never taken effect.
- Upgraded React Router to 8.3 and React to 19.2.7.
- Added a `preversion` check that stops a version bump when behind `origin/main`.
- Repository names in the statistics chart now use their proper spelling (e.g. Onedata, PaNOSC).
- Renamed "Dataverse Latvia" to "DataverseLV".
- The chat welcome message now reads "Welcome to the EOSC Data Commons Chat".

## [0.9.7] - 21/07/2026

- Harvested search results now show both the source repository and the aggregator logo.
- Failed tool launches now show the error, with a "Back to configuration" button.
- Tool search errors now read "No tools matched" instead of raw backend text.
- Fixed citation exports showing 1970 for datasets with no valid date.
- Backend timeouts in chat and search now show an error instead of a stuck spinner.
- Updated `systeminformation` to 5.33.0.
- These changes were first listed under 0.9.6, which was tagged before they were merged.

## [0.9.6] - 20/07/2026

- Updated `morgan` to 1.11.0. The other changes first listed here shipped in 0.9.7.

## [0.9.5] - 06/07/2026

- The dataplayer file tree starts collapsed and pages long lists.
- Added Remove and Reset all for additional datasets.
- Removed the "Back to Search Results" button.
- File preview errors now suggest downloading the file instead.
- The map-files step can no longer hang, and tools without parameters say so.
- Tool descriptions are shorter and free of Markdown.
- The tool list suggests starter searches (`jupyter`, `notebook`, `python`) and shows search errors.
- Chat failures now show an error message in the chat.

## [0.9.4] - 02/07/2026

- Task launches no longer fail when the EGI Secret Store is unreachable.

## [0.9.3] - 02/07/2026

- Tool launches now pass the user's VIP and GitHub keys from the EGI Secret Store to the coordinator.

## [0.9.2] - 02/07/2026

- Fixed the site returning HTTP 500 on Node runtimes without `sessionStorage` (0.9.0 and 0.9.1).
- Fixed a hydration mismatch in the recent searches panel.

## [0.9.1] - 02/07/2026

- Added least-privilege `permissions` to the GitHub Actions workflows.
- The Test workflow no longer enforces coverage thresholds.
- Removed tests for the dataplayer flow after the Play button, which the coordinator owns.

## [0.9.0] - 02/07/2026

- Added an automated test suite (Vitest, React Testing Library, MSW).
- Added a blocking Test workflow for PRs to main.
- Fixed citation exports crashing for datasets without creators.
- Fixed successful chat messages being logged as "No search results received" errors.

## [0.8.9] - 01/07/2026

- Updated the default model to `cesnet/agentic`.
- Switched number formatting to the `en-GB` locale.

## [0.8.8] - 30/06/2026

- Fixed an error panel showing when a search returned no datasets.

## [0.8.7] - 26/06/2026

- Added more detailed statistics to the landing page.

## [0.8.6] - 26/06/2026

- Fixed new chats from the landing page not appearing in the sidebar until a refresh.
- Capped the files sent to the tool-registry match API at 10.

## [0.8.5] - 24/06/2026

- Fixed the Data Sandbox showing misleading errors when opened while logged out.
- Signing in from a gated page now returns you to that page.

## [0.8.4] - 23/06/2026

- Data Sandbox launches now pass more context to the coordinator.

## [0.8.3] - 19/06/2026

- Added a profile page (`/profile`) for managing API keys stored in the EGI Secret Store.
- Files with no reported size now show "Unknown size" and cannot be previewed.

## [0.8.2] - 18/06/2026

- Fixed the production server failing to start in the container; the server is now bundled with `esbuild`.

## [0.8.1] - 18/06/2026

- Added Matomo event tracking for searches, AI mode, Play, Source, citations and filters.
- Added a "Were these results helpful?" feedback widget to the search results.

## [0.8.0] - 18/06/2026

- Rebuilt the Data Sandbox: launch tools and VREs on a dataset, with live task updates.
- Added a file tree, file previews (text, CSV, PDF, images) and adding extra files to a run.
- Added repository statistics with charts.
- The Play button now requires sign-in.
- Moved all gRPC calls to the server and split `DataplayerPage` into smaller parts.
- Removed the old dataplayer POC and dispatcher run page.
- Security: SSRF protection for file previews, and `noopener,noreferrer` on external windows.

## [0.7.4] - 11/06/2026

- Added the Privacy Policy (`/privacy-policy`) and Acceptable Use Policy (`/acceptable-use-policy`) pages.

## [0.7.3] - 08/06/2026

- Updated the default model to `cesnet/qwen3-coder`.
- Chat message summaries are no longer truncated, and the collapse button is right-aligned.
- Added programmatic focus for the chat input.
- Added the EU funding acknowledgement to the footer.
- Security: updated `react-router` to 7.17.0 (5 high-severity CVEs), `pm2` to 7.0.1 and `ws` to 8.21.

## [0.7.2] - 01/06/2026

- Added deleting a chat conversation, with confirmation.
- Moved the user initials logic into a shared `getUserInitials` utility.

## [0.7.0] - 22/05/2026

- Added an AI mode toggle to the search input for signed-in users.
- Added the chat page with message history.
- The landing page now shows the user menu.
- Added logos for HAL and PaNOSC, and updated the DABAR logo.
- Added an `.npmrc` rule preferring packages at least 3 days old.

## [0.6.1 -> 0.6.4] - 04/2026 -> 05/2026

- Dependency updates.

## [0.6.0] - 17/03/2026

- Added login, logout and a user menu.
- Updated the default search model to `einfracz/qwen3-coder` and added `einfracz/deepseek-v3.2-thinking`.
- Clearer search errors for rate limits and server errors.

## [0.5.3] - 23/02/2026

- The deployment workflow now runs only on `main`.
- Removed the changelog and version bump check on PRs to `main`.

## [0.5.1] - 23/02/2026

- Docker images are now built and deployed on version tags.
- `docker-compose.yml` now uses `npm run prod` for the frontend.

## [0.5.0] - 12/02/2026

- Moved from client-side to server-side rendering with React Router.

## [0.4.2] - 22/12/2025

- Added tooltips to search result score badges.

## [0.4.1] - 18/12/2025

- Filter options now update based on the selected filters.

## [0.4.0] - 17/12/2025

- Added faster client-side filtering of search results.
- Filters are now kept in the URL.

## [0.3.10] - 11/12/2025

- Updated `react-dom` and related libraries for a critical React
  vulnerability. [See details](https://www.heise.de/en/news/Patch-Now-Critical-Malware-Vulnerability-Threatens-React-11102482.html)

## [0.3.9] - 05/12/2025

- Citations are now fetched from DOI.org when available, with a local fallback.

## [0.3.8] - 03/12/2025

- Switched the Dispatcher API from dev3 to dev1.

## [0.3.7] - 01/12/2025

- Fixed "AI is analyzing" staying on screen when no results were found.

## [0.3.6] - 28/11/2025

- Fixed the favicon in Firefox and at `/favicon.ico`.

## [0.3.5] - 27/11/2025

- Fixed the favicon not showing in some browsers.

## [0.3.4] - 27/11/2025

- Minor landing page improvements.

## [0.3.3] - 26/11/2025

- Added timeouts to all backend API calls, with clearer error messages.

## [0.3.2] - 25/11/2025

- Renamed "analysis" to "Virtual Research Environment (VRE)" throughout the app.

## [0.3.1] - 24/11/2025

- Renamed the repository to `EOSC-Data-Commons/matchmaker` and updated links and image names.

## [0.3.0] - 24/11/2025

- Added the EOSC Player Dispatcher for running analyses on datasets from search results.
- Added repository logos to search results.
- Citation exports now use `publication_date`.
- The Cite button is now gray.
- Fixed the footer homepage link to use HTTPS.

## [0.2.1] - 13/11/2025

- Descriptions and author lists in search results are now expandable.
- Search scores are now shown as stars and percentages.
- Minor citation export improvements.
- Dependency updates.
- Disabled blank GitHub issues and added a link to Discussions.

## [0.2.0] - 07/11/2025

- Search now streams results over SSE, with better error handling.
- Added the `einfracz/gpt-oss-120b` search model.
- Redesigned the footer and added the e-INFRA CZ acknowledgement.
- Improved how search results are displayed.
- Dependency updates, including Vite.

## [0.1.1] - 03/11/2025

- Added Matomo analytics for page views.
- Improved responsiveness across the site.
- Upgraded Vite to 7.1.12.
- Improved the changelog check in CI.

## [0.1.0] - 17/10/2025

- Improved search experience with keyboard navigation and history dropdown.
- Dismissed disclaimers now stay hidden for your session.
- Updated landing page subtitle for clarity.
- Publication dates now use a consistent format.
- App version is now visible in the footer with a link to the changelog.
- Upgraded core technologies for better performance and stability.
- Various minor fixes and enhancements.
