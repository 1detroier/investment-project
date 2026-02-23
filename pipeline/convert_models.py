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
import sys

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
        raise FileNotFoundError(f"Local model file not found at: {h5_local}")

    # Convert to TF.js
    tfjs_path = os.path.join(ticker_dir, "tfjs")
    os.makedirs(tfjs_path, exist_ok=True)
    model = tf.keras.models.load_model(h5_local)
    tfjs.converters.save_keras_model(model, tfjs_path)
    print(f"  ✓ Converted to TF.js format")

    # List generated files
    generated_files = os.listdir(tfjs_path)
    print(f"  ✓ Generated: {generated_files}")

    # Upload TF.js files back to Supabase Storage
    for fname in generated_files:
        fpath = os.path.join(tfjs_path, fname)
        ct = "application/json" if fname.endswith(".json") else "application/octet-stream"
        print(f"    - Uploading {fname} ({ct})...")
        with open(fpath, "rb") as f:
            try:
                res = supabase.storage.from_("models").upload(
                    path=f"{ticker}/{fname}",
                    file=f,
                    file_options={"upsert": True, "content-type": ct}
                )
                
                # Robust error checking for different supabase-py versions
                error_msg = None
                if isinstance(res, dict):
                    if "error" in res and res["error"]:
                        error_msg = res["error"]
                elif hasattr(res, 'error') and res.error:
                    error_msg = res.error
                
                if error_msg:
                    raise Exception(f"Upload error for {fname}: {error_msg}")
                
                print(f"      ✓ Success: {res}")
            except Exception as e:
                # If upload fails because of 409 (already exists) even with upsert, or other issues
                print(f"      ✗ Upload failed for {fname}: {e}")
                raise e
    print(f"  ✓ TF.js files uploaded for {ticker}")


    has_errors = False
    with tempfile.TemporaryDirectory() as tmp:
        for ticker in TICKERS:
            try:
                convert_ticker(ticker, tmp)
            except Exception as e:
                print(f"  ✗ Failed {ticker}: {e}")
                has_errors = True

    if has_errors:
        print("\nConversion finished with ERRORS.")
        sys.exit(1)
    else:
        print("\nConversion complete.")
