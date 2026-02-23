import { supabase } from "./supabase";
import { DailyPrice } from "./types";

/**
 * Fetches the daily prices for a given ticker from Supabase.
 * The records are returned in chronological order (oldest to newest).
 */
export async function fetchPrices(ticker: string, days: number = 180): Promise<DailyPrice[]> {
    const { data, error } = await supabase
        .from("daily_prices")
        .select("*")
        .eq("ticker", ticker)
        .order("date", { ascending: false })
        .limit(days);

    if (error) {
        console.error("Error fetching prices:", error);
        throw new Error(error.message);
    }

    // Reverse to get chronological order which is required by Lightweight Charts and the LSTM model
    return data ? data.reverse() : [];
}
