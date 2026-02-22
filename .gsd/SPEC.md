# SPEC.md — Project Specification

> **Status**: `FINALIZED`

## Vision
To provide a free, mobile-first web dashboard that empowers retail investors with 3-day stock price forecasts for the top 10 STOXX Europe 600 companies by applying machine learning directly in the browser. It combines historical data, established technical indicators, and serverless technology to deliver fast, data-driven trading insights without complex tools.

## Goals
1. Provide instant 3-day price forecasts using LSTM neural networks running entirely client-side via TensorFlow.js.
2. Build an interactive, mobile-optimized dashboard displaying historical stock charts alongside key technical indicators (RSI, MACD, Moving Averages).
3. Establish an automated, zero-maintenance data pipeline using GitHub Actions to update prices daily and retrain models weekly.

## Non-Goals (Out of Scope)
- Fully automated trading execution.
- Complex portfolio management or brokerage integration.
- Server-side model inference (to maintain free-tier constraints).
- Analyzing companies outside of the initial top 10 STOXX Europe 600 (though the system will be built to scale).

## Users
### PRIMARY USER - "The Self-Directed Investor"
- **Demographics:** Age 25-40, tech-savvy retail investor.
- **Context:** Manages own portfolio of European stocks, uses mobile phone for checking stocks during the commute.
- **Pain point:** Too many technical indicators to interpret manually; desires ML-powered insights without enterprise tools.
- **Goal:** Make faster, data-driven trading decisions.

## Constraints
- **Cost:** All utilized services and infrastructure must operate comfortably within their generous free tiers.
- **Inference:** Machine learning models must run locally in the browser to eliminate server-side inference costs.
- **Automation:** Data fetching and updates must occur via reliable, automated cron jobs (GitHub Actions).
- **Scale:** Initial deployment is strictly limited to 10 companies.

## Success Criteria
- [ ] Next.js app deployed to Vercel (Hobby Tier) loading within acceptable mobile thresholds.
- [ ] LSTM models for all 10 companies successfully trained, converted to TF.js format, and served from Supabase Storage.
- [ ] Financial charts (TradingView Lightweight Charts) render accurately, displaying price, MA5, MA20, RSI, and MACD.
- [ ] User can view the 3-day forecast generated client-side within 2 seconds of selecting a ticker.
- [ ] GitHub Actions successfully run daily data ingestion (00:00 UTC) and weekly model retraining (Sundays).
