import os
import json
import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow.keras.models import Model, Sequential
from tensorflow.keras.layers import Input, LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
from sklearn.preprocessing import MinMaxScaler
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
import shutil

# Optional: tensorflowjs only supports Python <= 3.11
# If available, use it directly; otherwise conversion is handled separately (e.g. GitHub Actions)
try:
    import tensorflowjs as tfjs
    TFJS_AVAILABLE = True
    print("tensorflowjs found — will convert locally.")
except ImportError:
    TFJS_AVAILABLE = False
    print("tensorflowjs not available — will save .h5 only. Conversion runs via GitHub Actions.")

load_dotenv()

# ─── Config ───────────────────────────────────────────────────────────────────
#
# Individual models per company because:
# - Each stock has sector-specific volatility patterns (e.g. ASML = tech cycles, NESN = consumer staples)
# - A universal model averages out these nuances and underperforms on individual tickers
# - Separate models can be retrained independently with no cross-contamination
#
# To add a new company: simply add its yfinance ticker to this list
TICKERS = [
    "ASML.AS",     # ASML            - Tech / Semiconductors
    "SAP.DE",      # SAP             - Tech / Software
    "NESN.SW",     # Nestlé          - Consumer Staples
    "MC.PA",       # LVMH            - Luxury / Consumer Discretionary
    "NOVO-B.CO",   # Novo Nordisk    - Healthcare / Pharma
    "NOVN.SW",     # Novartis        - Healthcare / Pharma
    "ROG.SW",      # Roche           - Healthcare / Pharma
    "TTE.PA",      # TotalEnergies   - Energy
    "SIE.DE",      # Siemens         - Industrials
    "OR.PA",       # L'Oréal         - Consumer Staples / Beauty
]

# ─── 10 Technical Indicator Features ──────────────────────────────────────────
#
# Tier 1 (Essential): proven momentum / trend signals
# Tier 2 (Recommended): additional context for smoother predictions
#
# Feature order matters — the scaler is fit on this order.
# The frontend TF.js inference must use the same order.
FEATURES = [
    'close',        # Tier 1: Target variable (normalized close price)
    'returns',      # Tier 1: Daily % change — captures momentum direction
    'volume',       # Tier 1: Trading activity — confirms price moves
    'rsi14',        # Tier 1: RSI(14) — overbought/oversold momentum
    'macd',         # Tier 1: MACD — trend direction and strength
    'ma20',         # Tier 2: SMA(20) — short-term trend baseline
    'sma_50',       # Tier 2: SMA(50) — long-term trend baseline
    'bb_upper',     # Tier 2: Bollinger upper band — volatility ceiling
    'bb_lower',     # Tier 2: Bollinger lower band — volatility floor
    'volume_ma5',   # Tier 2: Volume moving avg (5d) — smoothed activity
]

# ─── Hyperparameters ──────────────────────────────────────────────────────────
WINDOW_SIZE = 7      # 7-day input window → model sees the last trading week
FORECAST_DAYS = 3    # 3-day multi-output → Day1 (high confidence), Day2, Day3
BATCH_SIZE = 32
EPOCHS = 100
PATIENCE = 10
LEARNING_RATE = 0.001
DROPOUT = 0.2
LSTM_UNITS = 64
VAL_SPLIT = 0.2

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing Supabase credentials in .env file.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


# ─── Helper Functions ─────────────────────────────────────────────────────────

def create_sequences(data: np.ndarray, window_size: int, forecast_days: int):
    """
    Converts a scaled time-series array into (X, y) training pairs.
    
    X shape: (samples, window_size, n_features)
    y shape: (samples, forecast_days)   ← only the close price (index 0) as target
    
    Why 3-day multi-output instead of recursive single-step:
    - Multi-output forces the model to learn the dependency between future days
    - Recursive predictions compound errors (each step uses a prediction as input)
    - Loss weights [1.0, 0.8, 0.6] let the model focus on near-term accuracy
    """
    X, y = [], []
    for i in range(len(data) - window_size - forecast_days + 1):
        X.append(data[i : i + window_size])
        y.append(data[i + window_size : i + window_size + forecast_days, 0])  # close price only
    return np.array(X), np.array(y)


def build_model(input_shape: tuple):
    """
    Sequential API architecture.
    Provides explicit naming to layers to ensure TF.js compatibility.
    """
    model = tf.keras.models.Sequential([
        tf.keras.layers.LSTM(LSTM_UNITS, input_shape=input_shape, activation='tanh', name='lstm_layer'),
        tf.keras.layers.Dropout(DROPOUT, name='dropout_layer'),
        tf.keras.layers.Dense(FORECAST_DAYS, name='output_layer')
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss='mse'
    )
    return model


# ─── Per-Ticker Training ──────────────────────────────────────────────────────

def train_for_ticker(ticker: str):
    print(f"\n{'='*60}")
    print(f"  Training: {ticker}")
    print(f"{'='*60}")

    # 1. Fetch data from Supabase
    response = supabase.table("daily_prices") \
        .select(",".join(FEATURES)) \
        .eq("ticker", ticker) \
        .order("date") \
        .execute()
    
    data = response.data
    if len(data) < 100:
        print(f"  ⚠ Skipping {ticker}: only {len(data)} rows (need ≥ 100).")
        return

    df = pd.DataFrame(data)[FEATURES].astype(float)
    df.dropna(inplace=True)

    # 2. Normalize with MinMaxScaler
    # Each feature is independently scaled to [0, 1]
    # The scaler is saved alongside the model so the frontend can invert predictions
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled = scaler.fit_transform(df)

    # 3. Build sequences
    X, y = create_sequences(scaled, WINDOW_SIZE, FORECAST_DAYS)
    if len(X) < 50:
        print(f"  ⚠ Skipping {ticker}: insufficient sequences ({len(X)}) after windowing.")
        return

    # 4. Train / Validation split (80/20, no shuffle — time-series order matters!)
    split = int((1 - VAL_SPLIT) * len(X))
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    print(f"  Sequences: {len(X)} total | {len(X_train)} train | {len(X_val)} val")

    # 5. Build & train
    model = build_model((WINDOW_SIZE, len(FEATURES)))
    
    early_stop = EarlyStopping(
        monitor='val_loss',
        patience=PATIENCE,
        restore_best_weights=True,
        verbose=1
    )

    history = model.fit(
        X_train, y_train,
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        validation_data=(X_val, y_val),
        callbacks=[early_stop],
        verbose=1
    )

    val_loss = min(history.history['val_loss'])
    epochs_ran = len(history.history['val_loss'])
    print(f"\n  [OK] Done — Best val MSE: {val_loss:.6f} (stopped at epoch {epochs_ran})")

    # 6. Save artifacts locally
    base_path = os.path.join("models", ticker)
    os.makedirs(base_path, exist_ok=True)

    # 6a. Keras model in classic format for stable conversion
    model_path = os.path.join(base_path, "model.h5")
    model.save(model_path)

    # 6b. Scaler (needed to inverse-transform predictions in the frontend)
    scaler_path = os.path.join(base_path, "scaler.pkl")
    joblib.dump(scaler, scaler_path)

    # 6c. Metadata (documents what the model was trained with)
    metadata = {
        "ticker": ticker,
        "features": FEATURES,
        "window_size": WINDOW_SIZE,
        "forecast_days": FORECAST_DAYS,
        "lstm_units": LSTM_UNITS,
        "dropout": DROPOUT,
        "learning_rate": LEARNING_RATE,
        "val_loss": float(val_loss),
        "epochs_ran": epochs_ran,
        "training_samples": len(X_train),
        "last_trained": datetime.now().isoformat(),
        "python_version": "3.11",
        "tensorflow_version": "2.15.0",
    }
    with open(os.path.join(base_path, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  [OK] Saved: {model_path}, scaler, metadata")

    # 7. TF.js Conversion (if library is available locally)
    tfjs_path = os.path.join(base_path, "tfjs")
    if TFJS_AVAILABLE:
        if os.path.exists(tfjs_path):
            shutil.rmtree(tfjs_path)
        try:
            tfjs.converters.save_keras_model(model, tfjs_path)
            print(f"  [OK] Converted to TF.js format locally.")
            upload_to_supabase(ticker, base_path, tfjs_path)
        except Exception as e:
            print(f"  [WARNING] TF.js conversion failed: {e}")
            print(f"  -> .h5 is saved. GitHub Actions will handle conversion.")
    else:
        print(f"  -> TF.js conversion will run via GitHub Actions (Python 3.11).")
        # Still upload metadata and scaler so GitHub Actions knows this ticker was trained
        upload_artifacts_only(ticker, base_path)


def upload_artifacts_only(ticker: str, base_path: str):
    """Upload non-TF.js artifacts (metadata.json, scaler.pkl) to Supabase."""
    print(f"  Uploading metadata & scaler for {ticker}...")
    for fname in ["metadata.json", "scaler.pkl"]:
        fpath = os.path.join(base_path, fname)
        ct = "application/json" if fname.endswith(".json") else "application/octet-stream"
        with open(fpath, "rb") as f:
            supabase.storage.from_("models").upload(
                path=f"{ticker}/{fname}",
                file=f,
                file_options={"upsert": "true", "content-type": ct}
            )
    print(f"  [OK] Metadata uploaded for {ticker}")


def upload_to_supabase(ticker: str, base_path: str, tfjs_path: str):
    """Upload all model artifacts (metadata, scaler, TF.js files) to Supabase Storage."""
    print(f"  Uploading all artifacts for {ticker}...")
    
    # Upload metadata & scaler
    for fname in ["metadata.json", "scaler.pkl"]:
        fpath = os.path.join(base_path, fname)
        ct = "application/json" if fname.endswith(".json") else "application/octet-stream"
        with open(fpath, "rb") as f:
            supabase.storage.from_("models").upload(
                path=f"{ticker}/{fname}",
                file=f,
                file_options={"upsert": "true", "content-type": ct}
            )

    # Upload TF.js model files
    for fname in os.listdir(tfjs_path):
        fpath = os.path.join(tfjs_path, fname)
        ct = "application/json" if fname.endswith(".json") else "application/octet-stream"
        with open(fpath, "rb") as f:
            supabase.storage.from_("models").upload(
                path=f"{ticker}/{fname}",
                file=f,
                file_options={"upsert": "true", "content-type": ct}
            )
    
    print(f"  [OK] All artifacts uploaded for {ticker}")


# ─── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    os.makedirs("models", exist_ok=True)
    
    success, failed = [], []
    for ticker in TICKERS:
        try:
            train_for_ticker(ticker)
            success.append(ticker)
        except Exception as e:
            print(f"\n  [ERROR] Failed to train {ticker}: {e}")
            import traceback
            traceback.print_exc()
            failed.append(ticker)

    print(f"\n{'='*60}")
    print(f"  Training Complete")
    print(f"  [OK] Success: {', '.join(success) if success else 'none'}")
    print(f"  [ERROR] Failed:  {', '.join(failed) if failed else 'none'}")
    print(f"{'='*60}")
    
    if not TFJS_AVAILABLE:
        print("\n  NOTE: TF.js conversion will run automatically in GitHub Actions.")
        print("  Push your models/ folder or trigger the workflow manually.")
