import { TICKERS } from "../lib/constants";

interface Props {
    selectedSymbol: string;
    onSelect: (symbol: string) => void;
}

export default function TickerSelector({ selectedSymbol, onSelect }: Props) {
    return (
        <div className="w-full overflow-x-auto pb-4 scrollbar-hide">
            <div className="flex space-x-2">
                {TICKERS.map((ticker) => {
                    const isSelected = ticker.symbol === selectedSymbol;
                    return (
                        <button
                            key={ticker.symbol}
                            onClick={() => onSelect(ticker.symbol)}
                            className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-all duration-200 ${isSelected
                                    ? "bg-[#00E5A0] text-[#0D1117] shadow-[0_0_15px_rgba(0,229,160,0.4)]"
                                    : "bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
                                }`}
                        >
                            <span className="font-bold">{ticker.symbol}</span>
                            <span className="ml-2 hidden opacity-70 sm:inline">{ticker.companyName}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
