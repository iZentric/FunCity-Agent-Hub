# Episode Navigator 1.2.0 — VeziAici / Clicksud

Install **only `veziaici-install.user.js`** into Tampermonkey. Disable older VeziAici scripts and addons. Replace the entire old script, save, allow the declared site/iframe permissions, then reload the episode page. Existing `va-index-v1` data is retained. `https://clicksud.xin/*` and its www alias are supported too; the trusted Vidmoly parent-origin allowlist includes both site families. Episode URLs must belong to the currently open site family; caches remain separate in each site’s localStorage. No automatic navigation between VeziAici and Clicksud. No API keys, paid services or external JS libraries are used at runtime.

`install-preview.html` embeds the entire identical script in an offline-capable copy-all textarea. Build both generated files using `node tools/build-veziaici.cjs`; verify with `--check`. The source is `veziaici-helper.user.js`; legacy pure pagination helpers are exported for older unit tests but excluded from the install script and are **not** used by its scanner.

## Behavior

- Recognizes normalized series/season/episode titles, preserves actual URLs. Never substitutes slug numbers.
- Public WordPress search API first, 100 rows/request until empty/WordPress invalid-page response. HTML fallback scans sequentially without a hard page limit. All discovered matching series episodes are saved, not just the requested season. A navigation request can open an unambiguous saved target before the entire scan completes; scanning resumes automatically on the destination if the catalog is not fresh.
- A completed API catalog prevents redundant automatic scans for 10 minutes. Manual search and an uncached next/previous target can still rescan immediately. If HTML parsing finds no recognized article links, the status reports that observation rather than proving the episode does not exist.
- Same-season playlist previous/next uses the closest lower/higher **available indexed episode**, not numeric ±1. It is based on the open page title. Start playlist scans the full catalog before choosing the smallest discovered episode in the selected season, so missing E1 does not block E3. Skip episod changes page; Sari intro only seeks within video. Incomplete/failed/stopped scans do not guess a minimum or navigate from a partial playlist. Multiple saved URLs for the target require a user choice. Saved-episode dropdown and cross-tab index updates. Current page URL is remembered before scanning.
- Stop preserves cache and cancels even delayed autostart. Restart-from-page-1 preserves discovered links. Neighboring pages (not media) are prefetched when a unique URL is cached.
- Native accessible HTML5 videos and the observed `https://vidmoly.org/embed-*` player are supported by separate frame components in the **same userscript**. Exact origin/source checks guard both message directions. No cross-origin security disabling, DRM bypass or login handling.
- ±10 seconds, manual skip, opt-in intro skip to the configured timestamp, opt-in next at end or timestamp. Intro/next preferences persist after page navigation; both default off. A user gesture may still be required to start playback. Other player hosts, site changes and browser permissions may prevent control. Search progress and ambiguity results are shown directly below navigation buttons, above video options. No guarantee of instant media startup or universal live-site success.

## Reproducible verification (Linux, Node 22)

```sh
node tools/build-veziaici.cjs --check
node --check tools/veziaici-install.user.js
node --test tools/veziaici-helper.test.cjs tools/veziaici-api.test.cjs
npm install --prefix /tmp/va-browser-test jsdom@26.1.0 --no-audit --no-fund
VA_SCRIPT=veziaici-install.user.js NODE_PATH=/tmp/va-browser-test/node_modules node --test tools/veziaici-browser.test.cjs
npm install --prefix /tmp/va-e2e playwright-core@1.64.1 @sparticuz/chromium@153.0.0 --no-audit --no-fund
NODE_PATH=/tmp/va-e2e/node_modules node tools/veziaici-e2e.cjs
VA_SITE=clicksud.xin NODE_PATH=/tmp/va-e2e/node_modules node tools/veziaici-e2e.cjs
```

26 pure/API tests + 16 DOM tests. Homepage primary action opens the exact target (fresh API search or cache); homepage autostart also indexes the selected series. Canonical API links are accepted from www pages. Chromium verifies automatic unordered-catalog scanning, real cross-origin frame messages, rejecting an untrusted origin, seeking, opt-in auto intro/persistence, hover/click navigation, cache retention, next-on-ended and no uncaught page errors. Browser security/site isolation are not disabled. Website/API/player requests are controlled fixtures and media time is a fixture property: this is **not real video decoding, live-site playback, or execution by the Tampermonkey extension in Brave**. The 2026-10-25 live-site content inspection separately identified the real Vidmoly embed in post 38702; it did not validate media playback.

The same commands run in `.github/workflows/episode-helper-tests.yml`. No secrets are needed. Test-only dependencies stay under `/tmp`, outside Git.

## Clicksud inspection

Public post 14116 at `https://clicksud.xin/wp-json/wp/v2/posts/14116?_fields=title,content` embeds exactly `https://vidmoly.org/embed-17xl8ph3das1.html` under Server 2, the same observed embed as VeziAici S30E11. Its category `/category/las-fierbinti-sezonul-30/` and public REST search list actual S30E10 and E11 links. This confirms discovery structure, not successful decoded playback. E2E is run separately with both host origins, with browser cross-origin security enabled. The Clicksud DOM regression uses the live-observed E10 title and URL and verifies a VeziAici link is rejected. External domains linked in prose (e.g. clicksud.org.uk) are not implicitly authorized.

## Playlist regression verification

The Chromium test now verifies real main-frame URL changes from E1 to E2 and from E3 to E7, previous across gaps, and starting from the minimum discovered item, on both supported host fixtures. Cached transitions assert no new catalog request. The DOM test starts with unordered pages (E9/E7 first, E3/E5 later, no E1) and asserts no navigation until every catalog page is read; the chosen minimum is E3. HTML cursor wrap is also completed before playlist selection.

An existing candidate from a previously completed catalog navigates directly even after the 10-minute freshness window (e.g. after watching a 42-minute episode). A stale playlist with no candidate rescans; manual reindex refreshes the catalog. This avoids blocking each cached Skip on a fresh scan. The DOM test verifies this with a 2-hour-old completed catalog.
