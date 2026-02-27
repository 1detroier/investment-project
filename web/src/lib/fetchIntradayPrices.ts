import { DailyPrice } from "./types";

type IntradayPoint = {
	timestamp: number;
	date: string;
	open: number | null;
	high: number | null;
	low: number | null;
	close: number | null;
	volume: number | null;
};

type IntradayResponse = {
	ticker: string;
	points: IntradayPoint[];
};

export async function fetchIntradayPrices(ticker: string): Promise<DailyPrice[]> {
	const response = await fetch(`/api/intraday?ticker=${encodeURIComponent(ticker)}`, {
		cache: "no-store",
	});

	if (!response.ok) {
		throw new Error(`Failed intraday fetch for ${ticker}`);
	}

	const payload = (await response.json()) as IntradayResponse;
	const points = Array.isArray(payload?.points) ? payload.points : [];

	return points
		.filter((point) => typeof point?.close === "number")
		.map((point, index) => ({
			id: index,
			ticker,
			date: point.date,
			open: point.open,
			high: point.high,
			low: point.low,
			close: point.close as number,
			volume: point.volume,
			returns: null,
			ma5: null,
			ma20: null,
			rsi14: null,
			macd: null,
			bb_upper: null,
			bb_lower: null,
			volatility: null,
			sma_50: null,
			volume_ma5: null,
			timestamp: point.timestamp,
		}));
}
