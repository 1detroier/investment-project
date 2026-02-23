import { DailyPrice } from "../lib/types";

interface Props {
    latestData: DailyPrice | null;
}

export default function StatBar({ latestData }: Props) {
    if (!latestData) {
        return (
            <div className="flex h-20 w-full animate-pulse items-center justify-between rounded-2xl bg-white/5 px-6">
                <div className="h-4 w-24 rounded bg-white/10"></div>
                <div className="h-4 w-24 rounded bg-white/10"></div>
                <div className="h-4 w-24 rounded bg-white/10"></div>
            </div>
        );
    }

    const isUp = (latestData.returns || 0) >= 0;
    const color = isUp ? "text-[#00E5A0]" : "text-[#FF4560]";
    const icon = isUp ? "▲" : "▼";

    return (
        <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-md">

            <div className="flex flex-col">
                <span className="text-xs text-zinc-500 uppercase tracking-widest">Last Close</span>
                <div className="mt-1 flex items-baseline space-x-3">
                    <span className="text-3xl font-light text-zinc-100">€{latestData.close.toFixed(2)}</span>
                    <span className={`text-sm font-medium ${color}`}>
                        {icon} {Math.abs(latestData.returns || 0).toFixed(2)}%
                    </span>
                </div>
            </div>

            <div className="flex space-x-12">
                <div className="flex flex-col items-end">
                    <span className="text-xs text-zinc-500 uppercase tracking-widest">Volume</span>
                    <span className="mt-1 text-lg text-zinc-200">
                        {latestData.volume ? (latestData.volume / 1000000).toFixed(2) + "M" : "N/A"}
                    </span>
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-xs text-zinc-500 uppercase tracking-widest">RSI (14)</span>
                    <span className={`mt-1 text-lg ${(latestData.rsi14 || 50) > 70 ? "text-[#FF4560]" :
                            (latestData.rsi14 || 50) < 30 ? "text-[#00E5A0]" : "text-zinc-200"
                        }`}>
                        {latestData.rsi14?.toFixed(2) || "N/A"}
                    </span>
                </div>
            </div>
        </div>
    );
}
