import { DailyPrice } from "./types";

/**
 * Fetches the latest quote from the server-side intraday proxy.
 */
export async function fetchLivePrice(ticker: string): Promise<Partial<DailyPrice> | null> {
	try {
		const response = await fetch(`/api/intraday?ticker=${encodeURIComponent(ticker)}`, {
			cache: "no-store",
		});

		if (!response.ok) return null;

		const json = await response.json();
		const latest = json?.latest;
		if (!latest || typeof latest.close !== "number") return null;

		return {
			ticker,
			date: latest.date,
			timestamp: latest.timestamp,
			open: latest.open ?? null,
			high: latest.high ?? null,
			low: latest.low ?? null,
			close: latest.close,
			volume: latest.volume ?? null,
		};
	} catch (error) {
		console.error("Error fetching live price:", error);
		return null;
	}
}
