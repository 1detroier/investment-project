"use client";

import { useState, useEffect, useMemo } from "react";
import TickerSelector from "../components/TickerSelector";
import TimeRangeSelector, { TimeRange } from "../components/TimeRangeSelector";
import StatBar from "../components/StatBar";
import StockChart from "../components/StockChart";
import IndicatorPanel from "../components/IndicatorPanel";
import ForecastCard from "../components/ForecastCard";
import { TICKERS } from "../lib/constants";
import { fetchPrices } from "../lib/fetchPrices";
import { runInference } from "../lib/runInference";
import { fetchLivePrice } from "../lib/fetchLivePrice";
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

  // Real-Time State
  const [livePrice, setLivePrice] = useState<Partial<DailyPrice> | null>(null);
  const [systemTime, setSystemTime] = useState(new Date());

  // Clock effect
  useEffect(() => {
    const timer = setInterval(() => setSystemTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // 1b. Poll for live price with adaptive cadence (15s visible / 45s hidden)
  useEffect(() => {
    let active = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;

    setLivePrice(null);

    const schedule = () => {
      if (!active) return;
      const isVisible = document.visibilityState === "visible";
      const intervalMs = isVisible ? 15000 : 45000;
      timeoutId = setTimeout(updateLivePrice, intervalMs);
    };

    const updateLivePrice = async () => {
      if (inFlight || !active) {
        schedule();
        return;
      }

      inFlight = true;
      try {
        const latest = await fetchLivePrice(selectedTicker);
        if (active && latest && typeof latest.close === "number") {
          setLivePrice((previous) => {
            const sameTick =
              previous?.timestamp === latest.timestamp &&
              previous?.close === latest.close;
            return sameTick ? previous : latest;
          });
        }
      } finally {
        inFlight = false;
        schedule();
      }
    };

    const handleVisibilityChange = () => {
      if (timeoutId) clearTimeout(timeoutId);
      schedule();
    };

    updateLivePrice();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedTicker]);

  // 1c. Merge Historical + Live for full context
  const augmentedPrices = useMemo(() => {
    if (prices.length === 0) return [];
    if (!livePrice || typeof livePrice.close !== "number") return prices;

    const lastHistorical = prices[prices.length - 1];

    // If live price is for the same day as historical, update historical
    if (livePrice.date === lastHistorical.date) {
      const updated = [...prices];
      updated[updated.length - 1] = {
        ...lastHistorical,
        ...livePrice,
        // Recalculate returns if possible or just use the price
        close: livePrice.close as number
      };
      return updated;
    }

    // If it's a new day, append
    if (new Date(livePrice.date as string) > new Date(lastHistorical.date)) {
      return [...prices, { ...lastHistorical, ...livePrice } as DailyPrice];
    }

    return prices;
  }, [prices, livePrice]);

  // 2. Run TF.js inference once historical prices are loaded.
  // Live ticks update the chart quickly without repeatedly re-running the model.
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

  const latestData = augmentedPrices.length > 0 ? augmentedPrices[augmentedPrices.length - 1] : null;

  // Filter prices based on timeRange
  const filteredPrices = (() => {
    if (augmentedPrices.length === 0) return [];

    const countMap: Record<TimeRange, number> = {
      "1W": 5,
      "1M": 21,
      "1Y": 252,
      "5Y": 1500
    };

    return augmentedPrices.slice(-countMap[timeRange]);
  })();

  return (
    <div className="min-h-screen bg-[#0D1117] text-zinc-300 font-sans p-4 sm:p-8">
      <main className="mx-auto max-w-6xl space-y-6">

        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-100 mb-1">Top 10 STOXX Europe 600 companies</h1>
            <div className="flex items-center gap-3">
              <p className="text-zinc-500 text-sm">Real-time ML stock forecasting dashboard.</p>
              {livePrice && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col text-[10px] text-zinc-500 leading-tight">
                      <span className="flex items-center gap-1">
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Sync: {new Date(livePrice.timestamp || "").toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {livePrice.timestamp && (
                        <span className={`flex items-center gap-1 ${Date.now() - (livePrice.timestamp as number) > 900000 ? "text-amber-500" : "text-emerald-500/80"}`}>
                          <span className={`w-1 h-1 rounded-full ${Date.now() - (livePrice.timestamp as number) > 900000 ? "bg-amber-500" : "bg-emerald-500"}`}></span>
                          Delay: {Math.floor((Date.now() - (livePrice.timestamp as number)) / 60000)}m
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-8 w-[1px] bg-white/5 hidden sm:block"></div>
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Local Time</span>
                    <span className="text-sm font-mono text-zinc-300 tabular-nums">{systemTime.toLocaleTimeString()}</span>
                  </div>
                </div>
              )}
            </div>
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
              <StockChart data={filteredPrices} forecasts={forecasts} timeRange={timeRange} />
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
