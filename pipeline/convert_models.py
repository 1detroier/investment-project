import os
import sys
import tempfile
import json
from dotenv import load_dotenv
import supabase
import tensorflowjs as tfjs
import tensorflow as tf

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.")
    sys.exit(1)

# Initialize Supabase client
supabase = supabase.create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Tickers to process
TICKERS = [
    "ASML.AS", "SAP.DE", "NESN.SW", "MC.PA", "NOVO-B.CO",
    "NOVN.SW", "ROG.SW", "TTE.PA", "SIE.DE", "OR.PA"
]

def patch_input_layers(obj):
    """
    Recursively searches for 'InputLayer' and renames 'batch_shape' to 'batchInputShape'.
    This is a defensive fix for TF.js browser compatibility.
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

def normalize_names(obj):
    """
    Recursively strips model-level prefixes from weight and layer names.
    Fixes: 'Provided weight data has no target variable'
    """
    prefixes = ["stock_prediction_model/", "sequential/", "sequential_1/", "sequential_2/"]
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "name" and isinstance(v, str):
                for p in prefixes:
                    if v.startswith(p):
                        obj[k] = v.replace(p, "")
                        break
            normalize_names(v)
    elif isinstance(obj, list):
        for item in obj:
            normalize_names(item)

def convert_ticker(ticker: str, tmp_dir: str):
    print(f"\nConverting {ticker}...")
    ticker_dir = os.path.join(tmp_dir, ticker)
    os.makedirs(ticker_dir, exist_ok=True)

    # Load the trained .h5 model from the local pipeline/models directory
    model_local = os.path.join(os.path.dirname(__file__), "models", ticker, "model.h5")
    
    if not os.path.exists(model_local):
        print(f"  [SKIP] Model file not found: {model_local}")
        return

    # Convert to TF.js
    tfjs_path = os.path.join(ticker_dir, "tfjs")
    os.makedirs(tfjs_path, exist_ok=True)
    
    # Standard Keras -> TF.js conversion
    try:
        model = tf.keras.models.load_model(model_local, compile=False)
    except Exception as e:
        if "Unrecognized keyword arguments" in str(e) or "DTypePolicy" in str(e):
            print(f"  [!] Metadata conflict detected (Keras 3 -> Keras 2). Patching H5 metadata...")
            # Fallback for environments with version mismatches (e.g. TF 2.20 vs older tfjs)
            import h5py
            import json
            with h5py.File(model_local, 'a') as f:
                if 'model_config' in f.attrs:
                    try:
                        config_str = f.attrs['model_config']
                        if hasattr(config_str, 'decode'):
                            config_str = config_str.decode('utf-8')
                        config = json.loads(config_str)
                        
                        # Recursive stripper for Keras 3 specific keys
                        def strip_k3_keys(obj):
                            if isinstance(obj, dict):
                                # Rename batch_shape to batch_input_shape (legacy)
                                if "batch_shape" in obj:
                                    obj["batch_input_shape"] = obj.pop("batch_shape")
                                
                                # Remove Keras 3 specific parameters not recognized by Keras 2
                                k3_keys = [
                                    "optional", "dtype_policy", "DTypePolicy", 
                                    "trainable", "dtype", "ragged", "sparse"
                                ]
                                for key in k3_keys:
                                    obj.pop(key, None)
                                    
                                for k, v in list(obj.items()):
                                    # Recursively clean nested dicts or configs
                                    if k == "config" and isinstance(v, dict):
                                        strip_k3_keys(v)
                                    elif isinstance(v, (dict, list)):
                                        strip_k3_keys(v)
                            elif isinstance(obj, list):
                                for item in obj:
                                    strip_k3_keys(item)
                        
                        strip_k3_keys(config)
                        f.attrs['model_config'] = json.dumps(config).encode('utf-8')
                        print(f"  [OK] Stripped Keras 3 metadata from {ticker}")
                    except Exception as patch_err:
                        print(f"  [WARNING] Failed to patch H5 metadata: {patch_err}")
            
            # Try loading again after patch
            model = tf.keras.models.load_model(model_local, compile=False)
        else:
            raise e

    tfjs.converters.save_keras_model(model, tfjs_path)
    print(f"  [OK] Converted to TF.js format")

    # Patch the model.json for browser compatibility
    model_json_path = os.path.join(tfjs_path, "model.json")
    if os.path.exists(model_json_path):
        with open(model_json_path, 'r') as f:
            model_json = json.load(f)
        
        if patch_input_layers(model_json):
            print(f"  [OK] Patched InputLayer config")
        
        # New normalization step
        normalize_names(model_json)
        print(f"  [OK] Normalized weight and layer names")

        with open(model_json_path, 'w') as f:
            json.dump(model_json, f)

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
