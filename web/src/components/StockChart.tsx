"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ColorType, CandlestickData, Time, LineData, HistogramData } from "lightweight-charts";
import { DailyPrice, ForecastResult } from "../lib/types";
import { TimeRange } from "./TimeRangeSelector";

interface Props {
    data: DailyPrice[];
    forecasts: ForecastResult[] | null;
    timeRange: TimeRange;
}

export default function StockChart({ data, forecasts, timeRange }: Props) {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#a1a1aa", // zinc-400
            },
            grid: {
                vertLines: { color: "rgba(255, 255, 255, 0.05)" },
                horzLines: { color: "rgba(255, 255, 255, 0.05)" },
            },
            crosshair: {
                mode: 1, // Normal crosshair
                vertLine: { color: "#a1a1aa", width: 1, style: 2 }, // dashed
                horzLine: { color: "#a1a1aa", width: 1, style: 2 }, // dashed
            },
            timeScale: {
                borderColor: "rgba(255, 255, 255, 0.1)",
                timeVisible: true,
                fixLeftEdge: true,
                fixRightEdge: true,
                tickMarkFormatter: (time: any, tickMarkType: number) => {
                    const date = new Date(time);

                    if (timeRange === "5Y") {
                        if (tickMarkType === 0) return date.getFullYear().toString(); // Year
                        if (tickMarkType === 1) return date.toLocaleString('default', { month: 'short' }); // Month
                    }

                    if (timeRange === "1Y" || timeRange === "1M") {
                        if (tickMarkType === 1) return date.toLocaleString('default', { month: 'short' }); // Month
                        if (tickMarkType === 2) return date.getDate().toString(); // Day
                    }

                    if (timeRange === "1W") {
                        const day = date.toLocaleDateString('default', { weekday: 'short' });
                        const dayNum = date.getDate();
                        return `${day} ${dayNum}`;
                    }

                    return date.toLocaleDateString();
                }
            },
            rightPriceScale: {
                borderColor: "rgba(255, 255, 255, 0.1)",
            },
        });

        chartRef.current = chart;

        // Candlestick Series
        const mainSeries = chart.addCandlestickSeries({
            upColor: "#00E5A0",
            downColor: "#FF4560",
            borderVisible: false,
            wickUpColor: "#00E5A0",
            wickDownColor: "#FF4560",
        });

        const candleData: CandlestickData[] = data.map((d) => ({
            time: d.date as Time,
            open: d.open || d.close,
            high: d.high || d.close,
            low: d.low || d.close,
            close: d.close,
        }));
        mainSeries.setData(candleData);

        // Volume Series
        const volumeSeries = chart.addHistogramSeries({
            color: "rgba(255, 255, 255, 0.2)",
            priceFormat: { type: "volume" },
            priceScaleId: "",
        });

        // Scale volume to bottom 20%
        chart.priceScale("").applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });

        const volData: HistogramData[] = data.map((d) => ({
            time: d.date as Time,
            value: d.volume || 0,
            color: (d.returns || 0) >= 0 ? "rgba(0, 229, 160, 0.4)" : "rgba(255, 69, 96, 0.4)",
        }));
        volumeSeries.setData(volData);

        // MA5 Overlay
        const ma5Series = chart.addLineSeries({
            color: "#3b82f6", // blue-500
            lineWidth: 2,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        const ma5Data: LineData[] = data
            .filter((d) => d.ma5 !== null)
            .map((d) => ({ time: d.date as Time, value: d.ma5 as number }));
        ma5Series.setData(ma5Data);

        // MA20 Overlay
        const ma20Series = chart.addLineSeries({
            color: "#f59e0b", // amber-500
            lineWidth: 2,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        const ma20Data: LineData[] = data
            .filter((d) => d.ma20 !== null)
            .map((d) => ({ time: d.date as Time, value: d.ma20 as number }));
        ma20Series.setData(ma20Data);

        // Forecast Overlay
        if (forecasts && forecasts.length > 0) {
            const forecastSeries = chart.addLineSeries({
                color: "#00E5A0",
                lineWidth: 2,
                lineStyle: 1, // Dotted
                crosshairMarkerVisible: true,
            });

            // Connect forecast to last known close
            if (data.length > 0) {
                const lastData = data[data.length - 1];
                forecastSeries.setData([
                    { time: lastData.date as Time, value: lastData.close },
                    ...forecasts.map((f) => ({ time: f.date as Time, value: f.predictedClose })),
                ]);
            }
        }

        // Responsive resize
        const handleResize = () => {
            chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
        };

        window.addEventListener("resize", handleResize);
        handleResize();
        chart.timeScale().fitContent();

        return () => {
            window.removeEventListener("resize", handleResize);
            chart.remove();
        };
    }, [data, forecasts]);

    return (
        <div className="h-[400px] w-full rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-md">
            <div ref={chartContainerRef} className="h-full w-full" />
        </div>
    );
}
