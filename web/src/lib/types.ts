export interface DailyPrice {
  id: number;
  ticker: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number;
  volume: number | null;
  returns: number | null;
  ma5: number | null;
  ma20: number | null;
  rsi14: number | null;
  macd: number | null;
  bb_upper: number | null;
  bb_lower: number | null;
  volatility: number | null;
  sma_50: number | null;
  volume_ma5: number | null;
}

export interface ForecastResult {
  date: string;
  predictedClose: number;
}

export interface TickerInfo {
  symbol: string;
  companyName: string;
  sector: string;
}
