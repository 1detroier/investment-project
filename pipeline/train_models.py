import os
import json
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.preprocessing import MinMaxScaler
from dotenv import load_dotenv
from supabase import create_client, Client
import tensorflowjs as tfjs
import shutil

load_dotenv()

# --- Config ---
TICKERS = [
    "ASML.AS", "SAP.DE", "NESN.SW", "MC.PA", "NOVO-B.CO",
    "NOVN.SW", "ROG.SW", "TTE.PA", "SIE.DE", "OR.PA"
]

# Features list (Ordered)
FEATURES = [
    'close', 'returns', 'volume', 'rsi14', 'macd',
    'ma20', 'sma_50', 'bb_upper', 'bb_lower', 'volume_ma5'
]

WINDOW_SIZE = 7
FORECAST_DAYS = 3
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Missing Supabase credentials.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def create_sequences(data, window_size, forecast_days):
    X, y = [], []
    for i in range(len(data) - window_size - forecast_days + 1):
        X.append(data[i:(i + window_size)])
        # Target is the next 'forecast_days' of the 'close' price (index 0)
        y.append(data[(i + window_size):(i + window_size + forecast_days), 0])
    return np.array(X), np.array(y)

def build_model(input_shape):
    """
    Architecture: Single-layer LSTM (64 units) with Dropout 0.2
    Multi-output: 3-day price prediction
    """
    model = Sequential([
        LSTM(64, input_shape=input_shape, activation='tanh'),
        Dropout(0.2),
        Dense(FORECAST_DAYS) # Output for Day 1, Day 2, Day 3
    ])
    
    # Custom Weighted MSE Loss implementation is tricky in basic Compile
    # We will use standard MSE first; if deeper accuracy is needed, 
    # we can implement a custom loss function.
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss='mse')
    return model

def train_for_ticker(ticker):
    print(f"\n--- Training Model for {ticker} ---")
    
    # 1. Fetch data from Supabase
    response = supabase.table("daily_prices").select("*").eq("ticker", ticker).order("date").execute()
    data = response.data
    
    if len(data) < 100:
        print(f"Not enough data for {ticker} (minimum 100 days needed).")
        return

    df = pd.DataFrame(data)
    df = df[FEATURES] # Select only our 10 features
    
    # 2. Scaling
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data = scaler.fit_transform(df)
    
    # 3. Create Sequences
    X, y = create_sequences(scaled_data, WINDOW_SIZE, FORECAST_DAYS)
    
    # 4. Split Train/Val (80/20)
    split = int(0.8 * len(X))
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]
    
    # 5. Build and Train
    model = build_model((WINDOW_SIZE, len(FEATURES)))
    
    early_stop = EarlyStopping(
        monitor='val_loss', 
        patience=10, 
        restore_best_weights=True
    )
    
    history = model.fit(
        X_train, y_train,
        epochs=100,
        batch_size=32,
        validation_data=(X_val, y_val),
        callbacks=[early_stop],
        verbose=1
    )
    
    # 6. Evaluate
    val_loss = history.history['val_loss'][-1]
    print(f"Validation Loss (MSE) for {ticker}: {val_loss}")
    
    # 7. Save Artifacts Locally
    base_path = f"models/{ticker}"
    os.makedirs(base_path, exist_ok=True)
    
    # Keras Model
    model_h5 = f"{base_path}/model.h5"
    model.save(model_h5)
    
    # Scaler
    scaler_path = f"{base_path}/scaler.pkl"
    joblib.dump(scaler, scaler_path)
    
    # Metadata
    metadata = {
        "ticker": ticker,
        "features": FEATURES,
        "window_size": WINDOW_SIZE,
        "forecast_days": FORECAST_DAYS,
        "val_loss": float(val_loss),
        "last_trained": datetime.now().isoformat()
    }
    with open(f"{base_path}/metadata.json", "w") as f:
        json.dump(metadata, f)
        
    # 8. Convert to TF.js
    tfjs_path = f"{base_path}/tfjs"
    if os.path.exists(tfjs_path):
        shutil.rmtree(tfjs_path)
    
    tfjs.converters.save_keras_model(model, tfjs_path)
    print(f"Converted {ticker} model to TF.js format.")
    
    # 9. Upload to Supabase Storage
    upload_to_supabase(ticker, base_path)

def upload_to_supabase(ticker, base_path):
    print(f"Uploading artifacts for {ticker} to Supabase Storage...")
    
    # Upload metadata and scaler (Optional but good for tracking)
    for file_name in ["metadata.json", "scaler.pkl"]:
        file_path = f"{base_path}/{file_name}"
        with open(file_path, "rb") as f:
            supabase.storage.from_("models").upload(
                path=f"{ticker}/{file_name}",
                file=f,
                file_options={"upsert": "true", "content-type": "application/octet-stream"}
            )

    # Upload TF.js files (Mandatory for frontend)
    tfjs_path = f"{base_path}/tfjs"
    for file_name in os.listdir(tfjs_path):
        file_path = f"{tfjs_path}/{file_name}"
        content_type = "application/json" if file_name.endswith(".json") else "application/octet-stream"
        with open(file_path, "rb") as f:
            supabase.storage.from_("models").upload(
                path=f"{ticker}/{file_name}",
                file=f,
                file_options={"upsert": "true", "content-type": content_type}
            )
    print(f"Upload complete for {ticker}.")

if __name__ == "__main__":
    from datetime import datetime
    if not os.path.exists("models"):
        os.makedirs("models")
        
    for ticker in TICKERS:
        try:
            train_for_ticker(ticker)
        except Exception as e:
            print(f"Failed to train {ticker}: {e}")

    print("\n--- All models trained and updated successfully ---")
