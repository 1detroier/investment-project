"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ColorType, Time } from "lightweight-charts";
import { DailyPrice } from "../lib/types";

interface Props {
    data: DailyPrice[];
}

export default function IndicatorPanel({ data }: Props) {
    const rsiContainerRef = useRef<HTMLDivElement>(null);
    const macdContainerRef = useRef<HTMLDivElement>(null);

    const rsiChartRef = useRef<IChartApi | null>(null);
    const macdChartRef = useRef<IChartApi | null>(null);

    useEffect(() => {
        if (!rsiContainerRef.current || !macdContainerRef.current) return;

        // --- RSI CHART ---
        const rsiChart = createChart(rsiContainerRef.current, {
            height: 150,
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#a1a1aa",
            },
            grid: {
                vertLines: { color: "rgba(255, 255, 255, 0.05)" },
                horzLines: { color: "rgba(255, 255, 255, 0.05)" },
            },
            timeScale: { visible: false },
            rightPriceScale: { borderColor: "rgba(255, 255, 255, 0.1)" },
        });
        rsiChartRef.current = rsiChart;

        const rsiSeries = rsiChart.addLineSeries({
            color: "#a855f7", // purple-500
            lineWidth: 2,
        });

        rsiSeries.setData(
            data.filter(d => d.rsi14 !== null).map(d => ({
                time: d.date as Time,
                value: d.rsi14 as number,
            }))
        );

        // RSI Overbought/Oversold lines
        rsiSeries.createPriceLine({ price: 70, color: "rgba(255, 69, 96, 0.5)", lineWidth: 1, lineStyle: 2 });
        rsiSeries.createPriceLine({ price: 30, color: "rgba(0, 229, 160, 0.5)", lineWidth: 1, lineStyle: 2 });

        // --- MACD CHART ---
        const macdChart = createChart(macdContainerRef.current, {
            height: 150,
            layout: {
                background: { type: ColorType.Solid, color: "transparent" },
                textColor: "#a1a1aa",
            },
            grid: {
                vertLines: { color: "rgba(255, 255, 255, 0.05)" },
                horzLines: { color: "rgba(255, 255, 255, 0.05)" },
            },
            timeScale: {
                borderColor: "rgba(255, 255, 255, 0.1)",
                timeVisible: true,
                fixLeftEdge: true,
                fixRightEdge: true,
            },
            rightPriceScale: { borderColor: "rgba(255, 255, 255, 0.1)" },
        });
        macdChartRef.current = macdChart;

        const macdSeries = macdChart.addHistogramSeries({
            color: "#3b82f6",
        });

        macdSeries.setData(
            data.filter(d => d.macd !== null).map(d => ({
                time: d.date as Time,
                value: d.macd as number,
                color: (d.macd as number) >= 0 ? "rgba(0, 229, 160, 0.6)" : "rgba(255, 69, 96, 0.6)",
            }))
        );

        const handleResize = () => {
            rsiChart.applyOptions({ width: rsiContainerRef.current?.clientWidth });
            macdChart.applyOptions({ width: macdContainerRef.current?.clientWidth });
        };

        window.addEventListener("resize", handleResize);
        handleResize();

        rsiChart.timeScale().fitContent();
        macdChart.timeScale().fitContent();

        return () => {
            window.removeEventListener("resize", handleResize);
            rsiChart.remove();
            macdChart.remove();
        };
    }, [data]);

    return (
        <div className="flex flex-col gap-4">
            <div className="w-full rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-md">
                <h3 className="mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest">RSI (14)</h3>
                <div ref={rsiContainerRef} className="w-full" />
            </div>
            <div className="w-full rounded-2xl border border-white/5 bg-white/5 p-4 backdrop-blur-md">
                <h3 className="mb-2 text-xs font-semibold text-zinc-500 uppercase tracking-widest">MACD</h3>
                <div ref={macdContainerRef} className="w-full" />
            </div>
        </div>
    );
}
