import { ForecastResult, DailyPrice } from "../lib/types";

interface Props {
    forecasts: ForecastResult[] | null;
    latestData: DailyPrice | null;
    loading: boolean;
    error: string | null;
}

export default function ForecastCard({ latestData, forecasts, loading, error }: Props) {
    if (loading) {
        return (
            <div className="rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-md animate-pulse">
                <div className="h-4 w-64 bg-white/10 rounded mb-4"></div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-24 bg-white/5 rounded-xl"></div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-400">
                <h3 className="font-semibold">AI Prediction Error</h3>
                <p className="mt-1 text-sm opacity-80">{error}</p>
            </div>
        );
    }

    if (!forecasts || !latestData) {
        return null; // Should not happen with current page.tsx logic
    }

    return (
        <div className="rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-md">
            <h3 className="text-sm font-semibold uppercase tracking-widest text-zinc-400">
                Prediction for the next three days
            </h3>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                {forecasts.map((f, i) => {
                const previousClose = i === 0 ? latestData.close : forecasts[i - 1].predictedClose;
                const diff = f.predictedClose - previousClose;
                const percentChange = previousClose === 0 ? 0 : (diff / previousClose) * 100;
                const isUp = diff >= 0;

                return (
                    <div key={f.date} className="rounded-2xl border border-white/5 bg-[#0D1117]/40 p-6 transition-all hover:bg-white/5">
                        <span className="text-xs text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                            Day {i + 1} <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded-full">{f.date}</span>
                        </span>

                        <div className="mt-4 flex items-baseline space-x-3">
                            <span className="text-3xl font-light text-zinc-100">€{f.predictedClose.toFixed(2)}</span>
                        </div>

                        <div className={`mt-2 text-sm font-medium flex items-center gap-1 ${isUp ? "text-[#00E5A0]" : "text-[#FF4560]"}`}>
                            {isUp ? "▲" : "▼"} {Math.abs(percentChange).toFixed(2)}%
                        </div>
                    </div>
                );
            })}
            </div>
        </div>
    );
}
