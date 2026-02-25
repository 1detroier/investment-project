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
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(url, {
            cache: "no-store",
            signal: controller.signal,
        }).finally(() => clearTimeout(timeout));
        if (!response.ok) return null;

        const json = await response.json();
        const result = json?.chart?.result?.[0];
        if (!result) return null;

        const meta = result.meta;
        const quote = result.indicators.quote[0];

        const closes: Array<number | null> = quote?.close ?? [];
        let lastIndex = closes.length - 1;
        while (lastIndex >= 0 && (closes[lastIndex] === null || closes[lastIndex] === undefined)) {
            lastIndex -= 1;
        }

        if (lastIndex < 0 || !meta?.regularMarketTime) return null;

        return {
            ticker: ticker,
            date: new Date(meta.regularMarketTime * 1000).toISOString().split('T')[0],
            timestamp: meta.regularMarketTime * 1000,
            open: quote.open?.[lastIndex] ?? null,
            high: quote.high?.[lastIndex] ?? null,
            low: quote.low?.[lastIndex] ?? null,
            close: quote.close?.[lastIndex] ?? null,
            volume: quote.volume?.[lastIndex] ?? null
        };
    } catch (error) {
        console.error("Error fetching live price:", error);
        return null;
    }
}
