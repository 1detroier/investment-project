# ROADMAP.md

> **Current Phase**: Phase 1: Foundation
> **Milestone**: v1.0

## Must-Haves (from SPEC)
- [ ] Automated daily stock data scraping for top 10 STOXX Europe 600 companies.
- [ ] Weekly LSTM model training pipeline via GitHub Actions.
- [ ] Browser-based LSTM inference using TensorFlow.js with zero server computation costs.
- [ ] Interactive TradingView Lightweight Charts dashboard showing historical prices and 3-day forecast.
- [ ] Supabase storage configuration for historical data (PostgreSQL) and model weights (Storage Bucket).

## Phases

### Phase 1: Foundation (Data & Infrastructure Setup)
**Status**: ✅ Completed
**Objective**: Setup the Supabase database and storage buckets, initialize the Next.js frontend, and configure the GitHub repository.

### Phase 2: Data Pipeline & Model Training
**Status**: ✅ Completed
**Objective**: Create the Python-based data ingestion script and the LSTM training/conversion pipeline, and set up GitHub Actions cron jobs.

### Phase 3: Dashboard & Charting 
**Status**: ✅ Completed
**Objective**: Build the Next.js frontend featuring TradingView Lightweight Charts displaying historical quotes, MA5, MA20, RSI, and MACD.

### Phase 4: Client-Side Inference Integration
**Status**: ✅ Completed
**Objective**: Integrate TensorFlow.js into the frontend to load models from Supabase and perform instantaneous 3-day stock price predictions.

### Phase 5: Polish & Vercel Deployment
**Status**: 🔵 In Progress
**Objective**: Finalize responsive UI, add loading states, gracefully handle missing data/model fetch errors, and deploy the application to Vercel Hobby Tier.

