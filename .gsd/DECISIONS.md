# DECISIONS.md

## 2026-02-25

| Decision | Choice | Why | Affects |
|----------|--------|-----|---------|
| Near real-time strategy | Client-side polling from Yahoo while user is active | Keeps dashboard near real-time without increasing GitHub Actions runs | `web/src/app/page.tsx`, `web/src/lib/fetchLivePrice.ts` |
| Free-tier optimization | Daily weekday ETL run at 17:20 UTC + concurrency cancel | Preserves GitHub free minutes and avoids overlapping workflow jobs | `.github/workflows/update_data.yml` |

## Notes

- Full implementation details and rollback paths are documented in `decisions_opencode.md`.
