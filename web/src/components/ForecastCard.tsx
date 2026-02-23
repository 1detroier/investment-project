import { ForecastResult, DailyPrice } from "../lib/types";

interface Props {
    forecasts: ForecastResult[] | null;
    latestData: DailyPrice | null;
    loading: boolean;
    error: string | null;
}

export default function ForecastCard({ forecasts, latestData, loading, error }: Props) {
    if (error) {
        return (
            <div className="w-full rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-400">
                <h3 className="font-semibold">AI Prediction Error</h3>
                <p className="mt-1 text-sm opacity-80">{error}</p>
            </div>
        );
    }

    if (loading || !forecasts || !latestData) {
        return (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex h-32 animate-pulse flex-col items-center justify-center rounded-2xl bg-white/5 p-6 border border-white/5">
                        <div className="h-4 w-16 bg-white/10 rounded mb-4"></div>
                        <div className="h-8 w-24 bg-white/10 rounded"></div>
                    </div>
                ))}
            </div>
        );
    }

    let previousClose = latestData.close;

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {forecasts.map((f, i) => {
                const diff = f.predictedClose - previousClose;
                const percentChange = (diff / previousClose) * 100;
                const isUp = diff >= 0;

                previousClose = f.predictedClose; // For day n+1 calculation

                return (
                    <div key={f.date} className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-md transition-all hover:bg-white/10">
                        <div className="absolute -right-4 -top-4 opacity-[0.03]">
                            <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor">
                                {isUp ? (
                                    <path d="M12 2L2 22h20L12 2z" />
                                ) : (
                                    <path d="M12 22L22 2H2l10 20z" />
                                )}
                            </svg>
                        </div>

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
    );
}
