# STATE.md

> **Current Phase**: Phase 5: Polish & Vercel Deployment
> **Status**: Active (resumed 2026-02-24T00:50)
> **Resumption Command**: `/resume`

## Active Context
- **Real-Time Improvements**: Data pipeline updated to 30m intervals (budget optimized). Dashboard shows ticking clock and delay indicator.
- **Model Conversion**: Fixed 400 errors by pinning TF 2.15.0 and implementing recursive metadata stripping in `convert_models.py`.
- **UX Polish**: Added loading skeletons to forecast cards for smoother ticker switching.

## Next Step
1. **Push to GitHub**: Push these changes to the `main` branch to trigger the `Convert Models to TF.js` workflow.
2. **Verify Models**: Check Supabase Storage after the workflow finishes to ensure `model.json` files are present.
3. **Vercel Deployment**: Once models are verified, the dashboard should be fully operational on Vercel.

## Open Issues
- **Model Files Missing**: `model.json` files are missing from Supabase Storage bucket `models`. This is the cause of the 400 error.
- **GitHub Secrets**: Potential issue with GitHub Secrets not being propagated to the environment, preventing model conversion/upload. Diagnostic tools implemented.

## 2026-02-25 Update
- **Near Real-Time Web**: Live polling tuned for lower cost (30s market-visible, 2m hidden, 10m off-hours) and safer live fetch behavior.
- **GitHub Actions Cost Control**: Data update workflow moved to once-per-weekday run (`17:20 UTC`) with concurrency cancellation.
- **Traceability**: All OpenCode changes + rollback instructions are documented in `decisions_opencode.md`.

### Next Step
1. Validate dashboard behavior on Vercel (ticker switch, delay indicator, off-hours cadence).
2. Open PR from `feature/realtime-live-price-updates` into `main`.
