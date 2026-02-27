"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ColorType, CandlestickData, Time, LineData, HistogramData, BusinessDay } from "lightweight-charts";
import { DailyPrice, ForecastResult } from "../lib/types";
import { TimeRange } from "./TimeRangeSelector";

interface Props {
    data: DailyPrice[];
    forecasts: ForecastResult[] | null;
    timeRange: TimeRange;
}

function toFiniteNumber(value: unknown): number | null {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : null;
	}

	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

function getSeriesTime(point: DailyPrice, timeRange: TimeRange): Time {
	if (timeRange === "1D") {
		if (typeof point.timestamp === "number") {
			return Math.floor(point.timestamp / 1000) as Time;
		}

		return Math.floor(new Date(`${point.date}T00:00:00Z`).getTime() / 1000) as Time;
	}

	const [year, month, day] = point.date.split("-").map(Number);
	return { year, month, day } as Time;
}

function getForecastTime(date: string, timeRange: TimeRange): Time {
	if (timeRange === "1D") {
		return Math.floor(new Date(`${date}T00:00:00Z`).getTime() / 1000) as Time;
	}

	const [year, month, day] = date.split("-").map(Number);
	return { year, month, day } as Time;
}

function toDate(time: Time): Date {
    if (typeof time === "string") return new Date(`${time}T00:00:00Z`);
    if (typeof time === "number") return new Date(time * 1000);

    const businessTime = time as BusinessDay;
    return new Date(Date.UTC(businessTime.year, businessTime.month - 1, businessTime.day));
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
                tickMarkFormatter: (time: Time) => {
                    const date = toDate(time);
                    const hour = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                    const day = date.toLocaleDateString("en-GB", { day: "2-digit" });
                    const month = date.toLocaleDateString("en-GB", { month: "short" });
                    const year = date.toLocaleDateString("en-GB", { year: "numeric" });

                    if (timeRange === "1D") {
                        return hour;
                    }

                    if (timeRange === "1W") {
                        return `${day}\n${month}`;
                    }

                    return `${day}\n${month}\n${year}`;
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

        const candleData: CandlestickData[] = data
			.map((d) => {
				const close = toFiniteNumber(d.close);
				const open = toFiniteNumber(d.open) ?? close;
				const high = toFiniteNumber(d.high) ?? close;
				const low = toFiniteNumber(d.low) ?? close;

				if (close === null || open === null || high === null || low === null) {
					return null;
				}

				return {
					time: getSeriesTime(d, timeRange),
					open,
					high,
					low,
					close,
				};
			})
			.filter((point): point is CandlestickData => point !== null);
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

        const volData: HistogramData[] = data.map((d) => {
			const volume = toFiniteNumber(d.volume) ?? 0;
			const returns = toFiniteNumber(d.returns) ?? 0;

			return {
				time: getSeriesTime(d, timeRange),
				value: volume,
				color: returns >= 0 ? "rgba(0, 229, 160, 0.4)" : "rgba(255, 69, 96, 0.4)",
			};
		});
        volumeSeries.setData(volData);

        // MA5 Overlay
        const ma5Series = chart.addLineSeries({
            color: "#3b82f6", // blue-500
            lineWidth: 2,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        const ma5Data: LineData[] = data
			.map((d) => {
				const ma5 = toFiniteNumber(d.ma5);
				if (ma5 === null) return null;

				return {
					time: getSeriesTime(d, timeRange),
					value: ma5,
				};
			})
			.filter((point): point is LineData => point !== null);
        ma5Series.setData(ma5Data);

        // MA20 Overlay
        const ma20Series = chart.addLineSeries({
            color: "#f59e0b", // amber-500
            lineWidth: 2,
            lastValueVisible: false,
            priceLineVisible: false,
        });
        const ma20Data: LineData[] = data
			.map((d) => {
				const ma20 = toFiniteNumber(d.ma20);
				if (ma20 === null) return null;

				return {
					time: getSeriesTime(d, timeRange),
					value: ma20,
				};
			})
			.filter((point): point is LineData => point !== null);
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
				const lastClose = toFiniteNumber(lastData.close);

				if (lastClose !== null) {
					const safeForecasts = forecasts
						.map((f) => {
							const predictedClose = toFiniteNumber(f.predictedClose);
							if (predictedClose === null) return null;

							return {
								time: getForecastTime(f.date, timeRange),
								value: predictedClose,
							};
						})
						.filter((point): point is LineData => point !== null);

					forecastSeries.setData([
						{
							time: getSeriesTime(lastData, timeRange),
							value: lastClose,
						},
						...safeForecasts,
					]);
				}
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
    }, [data, forecasts, timeRange]);

    return (
        <div className="h-[400px] w-full rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-md">
            <div ref={chartContainerRef} className="h-full w-full" />
        </div>
    );
}
