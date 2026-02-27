import { NextRequest, NextResponse } from "next/server";
import { TICKERS } from "@/lib/constants";

type YahooChartResult = {
	meta?: {
		regularMarketTime?: number;
	};
	timestamp?: number[];
	indicators?: {
		quote?: Array<{
			open?: Array<number | null>;
			high?: Array<number | null>;
			low?: Array<number | null>;
			close?: Array<number | null>;
			volume?: Array<number | null>;
		}>;
	};
};

const ALLOWED_TICKERS = new Set(TICKERS.map((ticker) => ticker.symbol));

export async function GET(request: NextRequest) {
	const ticker = request.nextUrl.searchParams.get("ticker")?.trim();

	if (!ticker || !ALLOWED_TICKERS.has(ticker)) {
		return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 8000);

	try {
		const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1m&range=1d`;
		const response = await fetch(yahooUrl, {
			headers: {
				"User-Agent": "Mozilla/5.0",
				Accept: "application/json",
			},
			cache: "no-store",
			signal: controller.signal,
		});

		if (!response.ok) {
			return NextResponse.json({ error: "Upstream provider error" }, { status: 502 });
		}

		const json = await response.json();
		const result: YahooChartResult | undefined = json?.chart?.result?.[0];
		const quote = result?.indicators?.quote?.[0];

		if (!result || !quote || !Array.isArray(result.timestamp)) {
			return NextResponse.json({ error: "Malformed provider payload" }, { status: 502 });
		}

		const timestamps = result.timestamp;
		const points: Array<{
			timestamp: number;
			date: string;
			open: number | null;
			high: number | null;
			low: number | null;
			close: number | null;
			volume: number | null;
		}> = [];

		for (let i = 0; i < timestamps.length; i += 1) {
			const close = quote.close?.[i] ?? null;
			if (close === null || close === undefined) continue;

			const tsMs = timestamps[i] * 1000;
			points.push({
				timestamp: tsMs,
				date: new Date(tsMs).toISOString().split("T")[0],
				open: quote.open?.[i] ?? close,
				high: quote.high?.[i] ?? close,
				low: quote.low?.[i] ?? close,
				close,
				volume: quote.volume?.[i] ?? null,
			});
		}

		const latest = points.length > 0 ? points[points.length - 1] : null;

		return NextResponse.json(
			{ ticker, points, latest, marketTimestamp: result.meta?.regularMarketTime ?? null },
			{
				headers: {
					"Cache-Control": "public, max-age=0, s-maxage=20, stale-while-revalidate=40",
				},
			},
		);
	} catch {
		return NextResponse.json({ error: "Failed to fetch intraday prices" }, { status: 502 });
	} finally {
		clearTimeout(timeout);
	}
}
