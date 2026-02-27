# DECISIONS.md

## 2026-02-25

| Decision | Choice | Why | Affects |
|----------|--------|-----|---------|
| Near real-time strategy | Client-side polling from Yahoo while user is active | Keeps dashboard near real-time without increasing GitHub Actions runs | `web/src/app/page.tsx`, `web/src/lib/fetchLivePrice.ts` |
| Free-tier optimization | Daily weekday ETL run at 17:20 UTC + concurrency cancel | Preserves GitHub free minutes and avoids overlapping workflow jobs | `.github/workflows/update_data.yml` |

## Notes

- Full implementation details and rollback paths are documented in `decisions_opencode.md`.

## 2026-02-26

| Decision | Choice | Why | Affects |
|----------|--------|-----|---------|
| Intraday delivery model | Serve Today (`1D`) candles via Next.js server route proxy to Yahoo | Avoid browser CORS failures while keeping near-real-time UX | `web/src/app/api/intraday/route.ts`, `web/src/lib/fetchIntradayPrices.ts`, `web/src/lib/fetchLivePrice.ts`, `web/src/app/page.tsx` |
| Free-tier telemetry baseline | Add Vercel Analytics in root layout | Measure DAU and engagement to tune `1m` vs `5m` polling with real usage data | `web/src/app/layout.tsx`, `web/package.json` |
