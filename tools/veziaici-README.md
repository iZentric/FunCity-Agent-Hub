# VeziAici Navigator 1.0.1

Install **only `veziaici-install.user.js`** into Tampermonkey. Disable older VeziAici scripts and addons. Replace the entire old script, save, allow the declared site/iframe permissions, then reload the episode page. Existing `va-index-v1` data is retained. No API keys, paid services or external JS libraries are used at runtime.

`install-preview.html` embeds the entire identical script in an offline-capable copy-all textarea. Build both generated files using `node tools/build-veziaici.cjs`; verify with `--check`. The source is `veziaici-helper.user.js`; legacy pure pagination helpers are exported for older unit tests but excluded from the install script and are **not** used by its scanner.

## Behavior

- Recognizes normalized series/season/episode titles, preserves actual URLs. Never substitutes slug numbers.
- Public WordPress search API first, 100 rows/request until empty/WordPress invalid-page response. HTML fallback scans sequentially without a hard page limit. All discovered matching series episodes are saved, not just the requested season. A navigation request can open an unambiguous saved target before the entire scan completes; scanning resumes automatically on the destination if the catalog is not fresh.
- A completed API catalog prevents redundant automatic scans for 10 minutes. Manual search and an uncached next/previous target can still rescan immediately. If HTML parsing finds no recognized article links, the status reports that observation rather than proving the episode does not exist.
- Same-season previous/next only, from the **open page's title**, not unsaved search-field changes. Multiple saved URLs for the target require a user choice. Saved-episode dropdown and cross-tab index updates. Current page URL is remembered before scanning.
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
```

26 pure/API tests + 12 DOM tests. Homepage primary action opens the exact target (fresh API search or cache); homepage autostart also indexes the selected series. Canonical API links are accepted from www pages. Chromium verifies automatic unordered-catalog scanning, real cross-origin frame messages, rejecting an untrusted origin, seeking, opt-in auto intro/persistence, hover/click navigation, cache retention, next-on-ended and no uncaught page errors. Browser security/site isolation are not disabled. Website/API/player requests are controlled fixtures and media time is a fixture property: this is **not real video decoding, live-site playback, or execution by the Tampermonkey extension in Brave**. The 2026-10-25 live-site content inspection separately identified the real Vidmoly embed in post 38702; it did not validate media playback.

The same commands run in `.github/workflows/episode-helper-tests.yml`. No secrets are needed. Test-only dependencies stay under `/tmp`, outside Git.
