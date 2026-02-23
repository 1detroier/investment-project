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

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("\n" + "="*50)
    print("CRITICAL ERROR: Supabase environment variables missing.")
    print("="*50)
    print(f"SUPABASE_URL found: {bool(SUPABASE_URL)}")
    print(f"SUPABASE_SERVICE_ROLE_KEY found: {bool(SUPABASE_KEY)}")
    print("\nREQUIRED ACTIONS:")
    if not SUPABASE_URL:
        print("- Go to Repository Settings > Secrets and variables > Actions.")
        print("- Create a SECRET (not a variable) named: SUPABASE_URL")
    if not SUPABASE_KEY:
        print("- Go to Repository Settings > Secrets and variables > Actions.")
        print("- Create a SECRET (not a variable) named: SUPABASE_SERVICE_ROLE_KEY")
    print("="*50 + "\n")
    sys.exit(1)

print(f"Initializing Supabase client with URL: {SUPABASE_URL}")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Verify bucket access early
try:
    buckets = supabase.storage.list_buckets()
    bucket_names = [b.name for b in buckets]
    if "models" not in bucket_names:
        print(f"CRITICAL ERROR: Bucket 'models' not found. Available buckets: {bucket_names}")
        sys.exit(1)
    print(f"[OK] Connected to Supabase and verified 'models' bucket access.")
except Exception as e:
    print(f"CRITICAL ERROR: Failed to connect to Supabase storage: {e}")
    sys.exit(1)


def patch_input_layers(obj):
    """
    Recursively searches for 'InputLayer' and renames 'batch_shape' to 'batchInputShape'.
    Keras 3 uses 'batch_shape' but TF.js Browser library requires 'batchInputShape'.
    """
    if isinstance(obj, dict):
        if obj.get("class_name") == "InputLayer":
            config = obj.get("config", {})
            if "batch_shape" in config:
                config["batchInputShape"] = config.pop("batch_shape")
                return True
        found = False
        for key, value in obj.items():
            if patch_input_layers(value):
                found = True
        return found
    elif isinstance(obj, list):
        found = False
        for item in obj:
            if patch_input_layers(item):
                found = True
        return found
    return False


def convert_ticker(ticker: str, tmp_dir: str):
    print(f"\nConverting {ticker}...")
    ticker_dir = os.path.join(tmp_dir, ticker)
    os.makedirs(ticker_dir, exist_ok=True)

    # Load the trained .keras model from the local pipeline/models directory
    model_local = os.path.join(os.path.dirname(__file__), "models", ticker, "model.keras")
    
    if not os.path.exists(model_local):
        raise FileNotFoundError(f"Local model file not found at: {model_local}")

    # Convert to TF.js
    tfjs_path = os.path.join(ticker_dir, "tfjs")
    os.makedirs(tfjs_path, exist_ok=True)
    
    # Load without compile to avoid any potential metric/optimizer issues
    model = tf.keras.models.load_model(model_local, compile=False)
    tfjs.converters.save_keras_model(model, tfjs_path)
    print(f"  [OK] Converted to TF.js format")

    # Final Patch: Fix InputLayer naming for browser compatibility
    model_json_path = os.path.join(tfjs_path, "model.json")
    if os.path.exists(model_json_path):
        with open(model_json_path, 'r') as f:
            model_json = json.load(f)
        
        if patch_input_layers(model_json):
            print(f"  [OK] Deep-patched model.json for browser compatibility")
            with open(model_json_path, 'w') as f:
                json.dump(model_json, f)
        else:
            print(f"  [INFO] No InputLayer found to patch in model.json")

    # List generated files
    generated_files = os.listdir(tfjs_path)
    print(f"  [OK] Generated: {generated_files}")

    # Upload TF.js files back to Supabase Storage
    for fname in generated_files:
        fpath = os.path.join(tfjs_path, fname)
        ct = "application/json" if fname.endswith(".json") else "application/octet-stream"
        print(f"    - Uploading {fname} ({ct})...")
        with open(fpath, "rb") as f:
            try:
                # Upsert="true" is required as a string by the Supabase Python client
                supabase.storage.from_("models").upload(
                    path=f"{ticker}/{fname}",
                    file=f,
                    file_options={"upsert": "true", "content-type": ct}
                )
                print(f"      [OK] Uploaded {fname}")
            except Exception as e:
                # Fallback to update if upload fails (e.g. if upsert has issues)
                if "already exists" in str(e).lower() or "409" in str(e):
                    with open(fpath, "rb") as f2:
                        supabase.storage.from_("models").update(
                            path=f"{ticker}/{fname}",
                            file=f2,
                            file_options={"content-type": ct}
                        )
                    print(f"      [OK] Updated {fname}")
                else:
                    print(f"      [ERROR] Upload failed for {fname}: {e}")
                    raise e


if __name__ == "__main__":
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
