import { DailyPrice } from "./types";

/**
 * Fetches the latest "Live" quote for a ticker.
 * This uses a lightweight query to a public market data endpoint.
 */
export async function fetchLivePrice(ticker: string): Promise<Partial<DailyPrice> | null> {
    try {
        // We use a CORS-friendly proxy or a direct public API if available.
        // For this demo, we can simulate or use an unofficial YF query.
        // NOTE: In a production app, you would use an API like AlphaVantage, Polygon.io, or your own backend.
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1m&range=1d`;

        const response = await fetch(url);
        if (!response.ok) return null;

        const json = await response.json();
        const result = json.chart.result[0];
        const meta = result.meta;
        const quote = result.indicators.quote[0];

        const lastIndex = quote.close.length - 1;

        return {
            ticker: ticker,
            date: new Date(meta.regularMarketTime * 1000).toISOString().split('T')[0],
            timestamp: meta.regularMarketTime * 1000,
            open: quote.open[lastIndex],
            high: quote.high[lastIndex],
            low: quote.low[lastIndex],
            close: quote.close[lastIndex],
            volume: quote.volume[lastIndex]
        };
    } catch (error) {
        console.error("Error fetching live price:", error);
        return null;
    }
}
