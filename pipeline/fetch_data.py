import os
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client
from utils.indicators import compute_indicators

load_dotenv()

# Top 10 STOXX Europe 600 companies by market cap (representative tickers)
TICKERS = [
    "ASML.AS",     # ASML
    "SAP.DE",      # SAP
    "NESN.SW",     # Nestle
    "MC.PA",       # LVMH
    "NOVO-B.CO",   # Novo Nordisk
    "NOVN.SW",     # Novartis
    "ROG.SW",      # Roche
    "TTE.PA",      # TotalEnergies
    "SIE.DE",      # Siemens
    "OR.PA"        # L'Oreal
]

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") # Use service role key to bypass RLS for inserts

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing Supabase credentials in environment.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_and_store_data(tickers, lookback_years=5):
    end_date = datetime.now()
    start_date = end_date - timedelta(days=365 * lookback_years)
    
    print(f"Fetching data from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}...")
    
    for ticker in tickers:
        print(f"Processing {ticker}...")
        try:
            # Fetch data from yfinance
            df = yf.download(ticker, start=start_date, end=end_date)
            
            if df.empty:
                print(f"No data returned for {ticker}.")
                continue
                
            # Flatten multi-index columns if returned by yfinance v0.2.x+
            if isinstance(df.columns, pd.MultiIndex):
                 df.columns = [c[0] for c in df.columns]
                
            # Compute technical indicators (Tier 1 & 2)
            df = compute_indicators(df)
            
            # Drop NaN rows resulting from indicator windows (e.g. SMA_50 needs 50 days)
            df = df.dropna()
            
            # Reset index to make 'Date' a column
            df = df.reset_index()
            
            # Ensure proper typing and replace NaNs/Infs for JSON serialization
            df = df.replace([np.inf, -np.inf], None)
            df = df.where(pd.notnull(df), None)
            
            records = []
            for _, row in df.iterrows():
                # Extract simple scalar values for insert
                record = {
                    "ticker": ticker,
                    "date": row['Date'].strftime('%Y-%m-%d'),
                    "open": float(row['Open']) if row['Open'] is not None else None,
                    "high": float(row['High']) if row['High'] is not None else None,
                    "low": float(row['Low']) if row['Low'] is not None else None,
                    "close": float(row['Close']) if row['Close'] is not None else None,
                    "volume": int(row['Volume']) if row['Volume'] is not None else None,
                    "returns": float(row['returns']) if row['returns'] is not None else None,
                    "ma20": float(row['ma20']) if row['ma20'] is not None else None,
                    "sma_50": float(row['sma_50']) if row['sma_50'] is not None else None,
                    "rsi14": float(row['rsi14']) if row['rsi14'] is not None else None,
                    "macd": float(row['macd']) if row['macd'] is not None else None,
                    "bb_upper": float(row['bb_upper']) if row['bb_upper'] is not None else None,
                    "bb_lower": float(row['bb_lower']) if row['bb_lower'] is not None else None,
                    "volume_ma5": float(row['volume_ma5']) if row['volume_ma5'] is not None else None
                }
                records.append(record)
            
            # Upsert into supabase in batches of 1000 to prevent payload too large errors
            batch_size = 1000
            inserted = 0
            for i in range(0, len(records), batch_size):
                batch = records[i:i+batch_size]
                res = supabase.table("daily_prices").upsert(batch, on_conflict="ticker,date").execute()
                inserted += len(batch)
            
            print(f"Successfully upserted {inserted} records for {ticker}.")
        
        except Exception as e:
            print(f"Error processing {ticker}: {str(e)}")

if __name__ == "__main__":
    fetch_and_store_data(TICKERS)
