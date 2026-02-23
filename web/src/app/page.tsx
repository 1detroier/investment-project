"use client";

import { useState, useEffect } from "react";
import TickerSelector from "../components/TickerSelector";
import TimeRangeSelector, { TimeRange } from "../components/TimeRangeSelector";
import StatBar from "../components/StatBar";
import StockChart from "../components/StockChart";
import IndicatorPanel from "../components/IndicatorPanel";
import ForecastCard from "../components/ForecastCard";
import { TICKERS } from "../lib/constants";
import { fetchPrices } from "../lib/fetchPrices";
import { runInference } from "../lib/runInference";
import { DailyPrice, ForecastResult } from "../lib/types";

export default function Home() {
  const [selectedTicker, setSelectedTicker] = useState(TICKERS[0].symbol);
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");

  // Data State
  const [prices, setPrices] = useState<DailyPrice[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);

  // Inference State
  const [forecasts, setForecasts] = useState<ForecastResult[] | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(true);
  const [forecastError, setForecastError] = useState<string | null>(null);

  // 1. Fetch historical OHLCV data
  useEffect(() => {
    let active = true;
    setLoadingPrices(true);
    setPriceError(null);

    fetchPrices(selectedTicker, 1500)
      .then((data) => {
        if (!active) return;
        setPrices(data);
        setLoadingPrices(false);
      })
      .catch((err) => {
        if (!active) return;
        setPriceError(err.message);
        setLoadingPrices(false);
      });

    return () => { active = false; };
  }, [selectedTicker]);

  // 2. Run TF.js inference once prices are loaded
  useEffect(() => {
    if (prices.length === 0 || loadingPrices) return;

    let active = true;
    setLoadingForecast(true);
    setForecastError(null);

    // Minor delay to ensure UI threads rendering main chart priority
    const timer = setTimeout(() => {
      runInference(selectedTicker, prices)
        .then((res) => {
          if (!active) return;
          setForecasts(res);
          setLoadingForecast(false);
        })
        .catch((err) => {
          if (!active) return;
          setForecastError(err.message);
          setLoadingForecast(false);
        });
    }, 100);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedTicker, prices, loadingPrices]);

  const latestData = prices.length > 0 ? prices[prices.length - 1] : null;

  // Filter prices based on timeRange
  const filteredPrices = (() => {
    if (prices.length === 0) return [];

    const countMap: Record<TimeRange, number> = {
      "1W": 5,
      "1M": 21,
      "1Y": 252,
      "5Y": 1500
    };

    return prices.slice(-countMap[timeRange]);
  })();

  return (
    <div className="min-h-screen bg-[#0D1117] text-zinc-300 font-sans p-4 sm:p-8">
      <main className="mx-auto max-w-6xl space-y-6">

        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-100 mb-1">European Equities 3-Day ML Forecast</h1>
            <p className="text-zinc-500 text-sm">Client-side TensorFlow.js processing on the Top 10 STOXX Europe 600 companies.</p>
          </div>
          <TimeRangeSelector selectedRange={timeRange} onSelect={setTimeRange} />
        </header>

        {/* TICKS */}
        <TickerSelector
          selectedSymbol={selectedTicker}
          onSelect={setSelectedTicker}
        />

        {/* STATS */}
        <StatBar latestData={latestData} />

        {/* ERRORS */}
        {priceError && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-500 text-sm">
            {priceError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            {/* MAIN CHART */}
            {loadingPrices ? (
              <div className="h-[400px] w-full animate-pulse rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md"></div>
            ) : (
              <StockChart data={filteredPrices} forecasts={forecasts} />
            )}

            {/* PREDICTED CARDS */}
            <ForecastCard
              loading={loadingForecast}
              error={forecastError}
              forecasts={forecasts}
              latestData={latestData}
            />
          </div>

          <div className="lg:col-span-1">
            {/* OSCILLATORS */}
            {loadingPrices ? (
              <div className="h-[320px] w-full animate-pulse rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md"></div>
            ) : (
              <IndicatorPanel data={filteredPrices} />
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
