import pandas as pd
import numpy as np
import ta

def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes required technical indicators for the predictive model.
    Input DataFrame must have 'Close', 'High', 'Low', 'Volume' columns.
    """
    df = df.copy()
    
    # Fill NaN values to prevent calculation errors on newest stocks
    df.ffill(inplace=True)
    
    # 1. Moving Averages
    df['ma5'] = df['Close'].rolling(window=5).mean()
    df['ma20'] = df['Close'].rolling(window=20).mean()
    
    # 2. Daily Returns
    df['returns'] = df['Close'].pct_change()
    
    # 3. RSI (14 period)
    df['rsi14'] = ta.momentum.RSIIndicator(close=df['Close'], window=14).rsi()
    
    # 4. MACD
    macd = ta.trend.MACD(close=df['Close'])
    df['macd'] = macd.macd()
    
    # 5. Bollinger Bands
    bollinger = ta.volatility.BollingerBands(close=df['Close'], window=20, window_dev=2)
    df['bb_upper'] = bollinger.bollinger_hband()
    df['bb_lower'] = bollinger.bollinger_lband()
    
    # 6. Volatility (20-day rolling standard deviation of returns)
    df['volatility'] = df['returns'].rolling(window=20).std()
    
    return df
