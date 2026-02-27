# decisions_opencode

This document records all code changes made by OpenCode in this session, why they were made, and how to modify or undo them in future sessions.

## Session Metadata

- Branch: `feature/realtime-live-price-updates`
- Commit: `8e6f50b`
- Remote branch: `origin/feature/realtime-live-price-updates`
- Area changed: frontend near real-time data behavior in `web/`
- Follow-up scope (uncommitted after `8e6f50b`): low-cost polling tune + GitHub Actions cost reduction

## Files Changed

1. `web/src/app/page.tsx`
2. `web/src/lib/fetchLivePrice.ts`

## Detailed Change Log

### 1) `web/src/app/page.tsx`

#### A. Added `useMemo` import

- Change: `import { useState, useEffect }` -> `import { useState, useEffect, useMemo }`
- Reason: stabilize derived `augmentedPrices` calculation and avoid recreating arrays on every render.

#### B. Reworked live price polling strategy

- Previous behavior:
  - Fixed `setInterval(updateLivePrice, 60000)` (60 seconds)
  - No overlap protection if request timing drifted
  - No visibility-based cadence
- New behavior:
  - Uses adaptive scheduling with `setTimeout`:
    - `15000ms` when tab is visible
    - `45000ms` when tab is hidden
  - Adds `inFlight` guard to avoid overlapping requests
  - Adds `visibilitychange` listener to recalculate cadence when tab visibility changes
  - Clears timer and listener on cleanup
  - Resets `livePrice` to `null` when ticker changes
- Reason:
  - More near real-time updates while user is actively viewing
  - Reduced unnecessary background traffic
  - Better stability under variable network latency

#### C. Prevented redundant state updates for unchanged ticks

- Change:
  - `setLivePrice(latest)` replaced with functional update:
    - compare previous and latest by `timestamp` and `close`
    - keep previous state when equal
- Reason:
  - Avoid unnecessary re-renders and chart refreshes when data has not changed.

#### D. Converted `augmentedPrices` to `useMemo`

- Previous behavior:
  - Derived array computed through an immediately-invoked function every render
- New behavior:
  - `useMemo` with dependencies `[prices, livePrice]`
  - Includes safer close check: `typeof livePrice.close === "number"`
- Reason:
  - Ensures recalculation only when relevant inputs change
  - Avoids churn in dependent components/effects

#### E. Changed inference trigger scope

- Previous behavior:
  - Inference used `runInference(selectedTicker, augmentedPrices)`
  - Effect depended on `augmentedPrices`
  - Live tick updates could repeatedly trigger model inference
- New behavior:
  - Inference now uses `runInference(selectedTicker, prices)`
  - Effect depends on `[selectedTicker, prices, loadingPrices]`
- Reason:
  - Keep chart updating quickly with live ticks
  - Avoid expensive repeated TF.js inference on each live update

### 2) `web/src/lib/fetchLivePrice.ts`

#### A. Added null-safe response traversal

- Previous behavior:
  - Direct access: `json.chart.result[0]`
- New behavior:
  - Safe access: `json?.chart?.result?.[0]`
  - Early return `null` if missing
- Reason:
  - Prevent runtime errors when upstream payload is incomplete or changed.

#### B. Added robust latest-candle selection

- Previous behavior:
  - Last index from `quote.close.length - 1` directly
- New behavior:
  - Walks backward through `quote.close` to find latest non-null close
  - Returns `null` if none found
  - Checks for `meta.regularMarketTime`
- Reason:
  - Yahoo intraday arrays can contain trailing nulls; this avoids publishing invalid candles.

#### C. Added optional chaining + null fallback for OHLCV

- Change:
  - `open/high/low/close/volume` now read with optional chaining and `?? null`
- Reason:
  - Defensive handling for partial quote arrays.

## Behavioral Impact

- Dashboard receives more frequent live updates while active.
- Background tabs poll less aggressively.
- Fewer unnecessary UI refreshes for unchanged ticks.
- Forecast inference runs on historical dataset load, not every live tick.
- Live fetch logic is safer under malformed/partial API responses.

## Follow-Up Changes (Cost + Security Simplification)

### 3) `web/src/app/page.tsx`

#### A. Reduced polling resource usage while keeping near real-time behavior

- Change:
  - Added market-aware interval selector:
    - Visible + weekday market hours (UTC 08-16): `30000ms`
    - Hidden tab: `120000ms`
    - Outside market hours: `600000ms`
- Reason:
  - Keeps user-facing updates near real-time during active trading windows
  - Significantly lowers external request volume off-hours and in background tabs

### 4) `web/src/lib/fetchLivePrice.ts`

#### A. Added safer request handling

- Change:
  - `ticker` is now URL-encoded with `encodeURIComponent`
  - Added `AbortController` timeout (8s)
  - Uses `cache: "no-store"` for fresh quotes
- Reason:
  - More robust network behavior
  - Avoid stuck requests
  - Prevent malformed symbol input from altering URL path

### 5) `.github/workflows/update_data.yml`

#### A. Lowered GitHub Actions usage for free-tier preservation

- Change:
  - Workflow name changed to `Update Stock Prices (Low-Cost Daily)`
  - Schedule changed from every 30 minutes during market hours to once per weekday:
    - `20 17 * * 1-5`
  - Added `concurrency` block:
    - group: `update-data`
    - cancel in-progress runs
- Reason:
  - Near real-time display is handled client-side by direct quote polling
  - Daily ETL is enough for historical baseline and model features
  - Fewer workflow minutes consumed on GitHub free tier

## What Was Not Changed

- No database schema changes.
- No API route/backend added.
- No model logic changed in `runInference.ts`.
- No chart component internals changed in `StockChart.tsx`.

## Verification Performed During Session

- Command run: `npm run lint` in `web/`
- Result:
  - Existing lint errors were reported in unrelated files:
    - `web/src/components/ForecastCard.tsx`
    - `web/src/components/StockChart.tsx`
    - `web/src/components/TickerSelector.tsx`
    - `web/src/lib/runInference.ts`
  - No additional lint errors were introduced by these two changed files in this session output.
- Follow-up command: `npx eslint "src/app/page.tsx" "src/lib/fetchLivePrice.ts"`
- Follow-up result: no lint errors in modified frontend files.

## How To Adjust These Changes Later

### Option 1: Tune polling frequency

Edit `web/src/app/page.tsx`:

- Visible-tab interval: change `15000`
- Hidden-tab interval: change `45000`
- Off-hours interval: change `600000`

Examples:
- More aggressive: `15000` visible, `60000` hidden, `300000` off-hours
- More conservative: `45000` visible, `180000` hidden, `900000` off-hours

### Option 2: Re-enable inference on live ticks

In `web/src/app/page.tsx`:

1. Replace `runInference(selectedTicker, prices)` with `runInference(selectedTicker, augmentedPrices)`
2. Add `augmentedPrices` back to inference effect dependencies

Note: this increases model execution frequency and may affect performance.

### Option 3: Keep old fixed 60s polling

In `web/src/app/page.tsx`, revert the adaptive timeout logic to:

- one `setInterval(updateLivePrice, 60000)`
- remove visibility listener and `inFlight` guard

## How To Undo Everything

### Undo locally (safe rollback branch)

From repository root:

```bash
git checkout feature/realtime-live-price-updates
git revert 8e6f50b
```

This creates a new commit that reverses all changes from this session.

### Reset branch to before this change (history rewrite)

Only if you intentionally want to rewrite branch history:

```bash
git checkout feature/realtime-live-price-updates
git reset --hard 8e6f50b^
```

If already pushed, this requires a force push and team coordination.

### Restore specific file only

```bash
git checkout 8e6f50b^ -- web/src/app/page.tsx
git checkout 8e6f50b^ -- web/src/lib/fetchLivePrice.ts
```

Then commit the partial rollback.

## Notes For Future Sessions

- If you plan true real-time streaming (sub-second or websocket), introduce a backend market feed and push events to the client.
- Current setup is polling-based and bounded by external Yahoo endpoint behavior.
- If app performance degrades, profile re-renders in `page.tsx` first (especially on rapid ticker switching).
