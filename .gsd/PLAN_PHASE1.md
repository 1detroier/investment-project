# Phase 1 Execution Plan: Foundation & Infrastructure

This document outlines the granular execution steps for Phase 1 of the STOXX Europe 50 ML Predictor Dashboard.

---

## 1. Database Setup (Supabase)
* **Objective:** Initialize the database schema for historical prices and technical indicators, and create a public storage bucket for TF.js models.
* **Exact files to create:**
  * supabase/schema.sql (Schema definition for daily_prices table and RLS policies)
* **Commands to run:**
  * 
px supabase init
  * 
px supabase start (or execute SQL directly in Supabase web UI)
  * 
px supabase db push
* **Environment variables needed:**
  * SUPABASE_URL
  * SUPABASE_KEY (or SUPABASE_SERVICE_ROLE_KEY for Python scripts)
* **Expected output/verification:**
  * Confirmation that the daily_prices table exists.
  * Confirmation that the models public storage bucket exists.
* **Time estimate:** 30-45 minutes
* **Dependencies on previous steps:** None

## 2. Data Pipeline (Python scripts)
* **Objective:** Create a Python script to fetch historical data for the top 10 STOXX 600 companies via yfinance, calculate technical indicators, and upload them to Supabase.
* **Exact files to create:**
  * pipeline/fetch_data.py
  * pipeline/requirements.txt
* **Commands to run:**
  * pip install -r pipeline/requirements.txt
  * python pipeline/fetch_data.py
* **Environment variables needed:**
  * SUPABASE_URL
  * SUPABASE_SERVICE_ROLE_KEY
* **Expected output/verification:**
  * Successful script execution indicating X records inserted.
  * Verifying rows populate in the Supabase daily_prices table.
* **Time estimate:** 2 hours
* **Dependencies on previous steps:** 1. Database Setup

## 3. Model Training (LSTM + Export)
* **Objective:** Train a single-layer LSTM (7-day window, 10 features) on historical data, convert the model to TF.js format, and upload it to Supabase Storage.
* **Exact files to create:**
  * pipeline/train_model.py
  * pipeline/utils/indicators.py
* **Commands to run:**
  * python pipeline/train_model.py
* **Environment variables needed:**
  * SUPABASE_URL
  * SUPABASE_SERVICE_ROLE_KEY
* **Expected output/verification:**
  * Output indicating early stopping or completion of training epochs.
  * model.json and .bin weights successfully uploaded to models/{ticker}/ path in Supabase Storage.
* **Time estimate:** 3 hours
* **Dependencies on previous steps:** 2. Data Pipeline

## 4. Frontend Setup (Next.js + Charts)
* **Objective:** Initialize the Next.js App Router application, configure Tailwind CSS, and build a dashboard layout embedding TradingView Lightweight Charts.
* **Exact files to create:**
  * pp/page.tsx
  * pp/layout.tsx
  * components/Dashboard.tsx
  * components/Chart.tsx
* **Commands to run:**
  * 
px create-next-app@latest . --typescript --tailwind --eslint --app
  * 
pm install lightweight-charts @supabase/supabase-js
  * 
pm run dev
* **Environment variables needed:**
  * NEXT_PUBLIC_SUPABASE_URL
  * NEXT_PUBLIC_SUPABASE_ANON_KEY
* **Expected output/verification:**
  * Application runs locally (localhost:3000).
  * TradingView chart renders on the screen, fetching historical data from Supabase.
* **Time estimate:** 2 hours
* **Dependencies on previous steps:** 1. Database Setup, 2. Data Pipeline

## 5. Integration (TF.js Inference)
* **Objective:** Integrate TensorFlow.js into the frontend to load the .json model from Supabase, process recent data points, and plot the 3-day forecast on the chart.
* **Exact files to create:**
  * lib/tfjs_inference.ts
  * components/PredictionPanel.tsx
* **Commands to run:**
  * 
pm install @tensorflow/tfjs
* **Environment variables needed:**
  * None specific (uses public Supabase URL for bucket storage).
* **Expected output/verification:**
  * Component logs "Model loaded successfully".
  * Predicts 3 future price points that render continuously from the last historical data point on the chart.
* **Time estimate:** 3-4 hours
* **Dependencies on previous steps:** 3. Model Training, 4. Frontend Setup

## 6. Deployment (Vercel + GitHub Actions)
* **Objective:** Deploy the Next.js app to Vercel and configure GitHub Actions chron jobs for daily data updates and weekly model retraining.
* **Exact files to create:**
  * .github/workflows/daily_data.yml
  * .github/workflows/weekly_train.yml
* **Commands to run:**
  * Push code to GitHub repository to trigger Vercel deployment automatically.
* **Environment variables needed:**
  * GitHub Repository Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  * Vercel Environment Variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
* **Expected output/verification:**
  * Vercel deployment reports "Ready".
  * App is accessible on the custom domain or generic .vercel.app domain.
  * GitHub actions pass their first manual trigger/scheduled run.
* **Time estimate:** 1 hour
* **Dependencies on previous steps:** All previous steps.
