import pandas as pd
import numpy as np
import ta

def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes required 10 technical indicators for the predictive model.
    TIER 1: Close, Returns, Volume, RSI_14, MACD
    TIER 2: SMA_20, SMA_50, BB_Upper, BB_Lower, Volume_MA5
    """
    df = df.copy()
    
    # Fill NaN values to prevent calculation errors
    df.ffill(inplace=True)
    
    # --- TIER 1 ---
    # 1. Close (already present)
    
    # 2. Returns (daily % change)
    df['returns'] = df['Close'].pct_change()
    
    # 3. Volume (already present)
    
    # 4. RSI (14 period)
    df['rsi14'] = ta.momentum.RSIIndicator(close=df['Close'], window=14).rsi()
    
    # 5. MACD
    macd = ta.trend.MACD(close=df['Close'])
    df['macd'] = macd.macd()
    
    # --- TIER 2 ---
    # 6. SMA_20
    df['ma20'] = df['Close'].rolling(window=20).mean()
    
    # 7. SMA_50
    df['sma_50'] = df['Close'].rolling(window=50).mean()
    
    # 8 & 9. Bollinger Bands
    bollinger = ta.volatility.BollingerBands(close=df['Close'], window=20, window_dev=2)
    df['bb_upper'] = bollinger.bollinger_hband()
    df['bb_lower'] = bollinger.bollinger_lband()
    
    # 10. Volume_MA5
    df['volume_ma5'] = df['Volume'].rolling(window=5).mean()
    
    # Volatility (Optional bonus feature from before, keeping for potential use or dropping to stick to 10)
    # The user asked for exactly 10 features. I will keep 'volatility' as an 11th if it helps, 
    # but the instructions say "Total features: 10 technical indicators".
    # I'll stick to the 10 specified.
    
    return df
