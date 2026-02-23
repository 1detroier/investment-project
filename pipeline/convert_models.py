"""
convert_models.py — TF.js Conversion Script
Runs in GitHub Actions on Python 3.11 (required for tensorflowjs compatibility).
Downloads trained .h5 models from Supabase Storage, converts them to TF.js format,
and re-uploads the converted files.
"""

import os
import json
import shutil
import tempfile
from dotenv import load_dotenv
from supabase import create_client, Client
import tensorflowjs as tfjs
import tensorflow as tf

load_dotenv()

TICKERS = [
    "ASML.AS", "SAP.DE", "NESN.SW", "MC.PA", "NOVO-B.CO",
    "NOVN.SW", "ROG.SW", "TTE.PA", "SIE.DE", "OR.PA"
]

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def convert_ticker(ticker: str, tmp_dir: str):
    print(f"\nConverting {ticker}...")
    ticker_dir = os.path.join(tmp_dir, ticker)
    os.makedirs(ticker_dir, exist_ok=True)

    # Load the trained .h5 model from the local pipeline/models directory
    # (Since this script runs in GitHub Actions, the files are already checked out)
    h5_local = os.path.join(os.path.dirname(__file__), "models", ticker, "model.h5")
    
    if not os.path.exists(h5_local):
        print(f"  ⚠ Local model file not found: {h5_local}")
        return

    # Convert to TF.js
    tfjs_path = os.path.join(ticker_dir, "tfjs")
    os.makedirs(tfjs_path, exist_ok=True)
    model = tf.keras.models.load_model(h5_local)
    tfjs.converters.save_keras_model(model, tfjs_path)
    print(f"  ✓ Converted to TF.js format")

    # Upload TF.js files back to Supabase Storage
    for fname in os.listdir(tfjs_path):
        fpath = os.path.join(tfjs_path, fname)
        ct = "application/json" if fname.endswith(".json") else "application/octet-stream"
        with open(fpath, "rb") as f:
            supabase.storage.from_("models").upload(
                path=f"{ticker}/{fname}",
                file=f,
                file_options={"upsert": "true", "content-type": ct}
            )
    print(f"  ✓ TF.js files uploaded for {ticker}")


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        for ticker in TICKERS:
            try:
                convert_ticker(ticker, tmp)
            except Exception as e:
                print(f"  ✗ Failed {ticker}: {e}")

    print("\nConversion complete.")
