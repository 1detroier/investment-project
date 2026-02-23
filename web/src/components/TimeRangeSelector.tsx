"use client";

import React from "react";

export type TimeRange = "1W" | "1M" | "1Y" | "5Y";

interface Props {
    selectedRange: TimeRange;
    onSelect: (range: TimeRange) => void;
}

export default function TimeRangeSelector({ selectedRange, onSelect }: Props) {
    const ranges: TimeRange[] = ["1W", "1M", "1Y", "5Y"];

    return (
        <div className="flex space-x-2 bg-[#161B22] p-1 rounded-xl border border-white/5 shadow-sm">
            {ranges.map((range) => (
                <button
                    key={range}
                    onClick={() => onSelect(range)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${selectedRange === range
                            ? "bg-[#00E5A0] text-[#0D1117] shadow-[0_0_10px_rgba(0,229,160,0.3)]"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                        }`}
                >
                    {range}
                </button>
            ))}
        </div>
    );
}
