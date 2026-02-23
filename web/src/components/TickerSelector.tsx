"use client";

import { useState, useRef, useEffect } from "react";
import { TICKERS } from "../lib/constants";

interface Props {
    selectedSymbol: string;
    onSelect: (symbol: string) => void;
}

export default function TickerSelector({ selectedSymbol, onSelect }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selectedTicker = TICKERS.find(t => t.symbol === selectedSymbol) || TICKERS[0];

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const filteredTickers = TICKERS.filter(
        (t) =>
            t.symbol.toLowerCase().includes(search.toLowerCase()) ||
            t.companyName.toLowerCase().includes(search.toLowerCase()) ||
            t.sector.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="relative w-full z-50 pb-2" ref={dropdownRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full sm:w-80 bg-[#161B22] border border-white/10 hover:border-[#00E5A0]/50 rounded-xl px-4 py-3 cursor-pointer transition-colors shadow-sm"
            >
                <div>
                    <span className="font-bold text-[#00E5A0]">{selectedTicker.symbol}</span>
                    <span className="ml-2 text-zinc-400 text-sm">{selectedTicker.companyName}</span>
                </div>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-5 w-5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {isOpen && (
                <div className="absolute top-16 left-0 w-full sm:w-96 bg-[#161B22] border border-white/10 rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl">
                    <div className="p-3 border-b border-white/10 bg-[#0D1117]/50">
                        <div className="relative">
                            <svg xmlns="http://www.w3.org/2000/svg" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                                type="text"
                                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#00E5A0]/50 focus:bg-white/10 transition-colors placeholder-zinc-500"
                                placeholder="Search by ticker, name, or sector..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto scrollbar-hide">
                        {filteredTickers.length > 0 ? (
                            filteredTickers.map((ticker) => (
                                <div
                                    key={ticker.symbol}
                                    onClick={() => {
                                        onSelect(ticker.symbol);
                                        setIsOpen(false);
                                        setSearch("");
                                    }}
                                    className={`px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-white/5 transition-colors ${ticker.symbol === selectedSymbol ? 'bg-[#00E5A0]/10 border-l-2 border-[#00E5A0]' : 'border-l-2 border-transparent'
                                        }`}
                                >
                                    <div className="flex flex-col">
                                        <span className={`font-bold ${ticker.symbol === selectedSymbol ? 'text-[#00E5A0]' : 'text-zinc-200'}`}>
                                            {ticker.symbol}
                                        </span>
                                        <span className="text-xs text-zinc-400">{ticker.companyName}</span>
                                    </div>
                                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded bg-white/5 text-zinc-500">
                                        {ticker.sector}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
                                No companies found matching "{search}"
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
