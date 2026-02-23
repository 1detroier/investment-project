import os
import json
import joblib
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing Supabase credentials in .env file.")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

MODELS_DIR = "models"
if not os.path.exists(MODELS_DIR):
    print(f"{MODELS_DIR} not found locally. Are we in the right directory?")
    exit(1)

for ticker in os.listdir(MODELS_DIR):
    ticker_dir = os.path.join(MODELS_DIR, ticker)
    if not os.path.isdir(ticker_dir):
        continue
    
    scaler_path = os.path.join(ticker_dir, "scaler.pkl")
    if not os.path.exists(scaler_path):
        print(f"[{ticker}] No scaler.pkl found.")
        continue
    
    print(f"[{ticker}] Converting scaler.pkl to scaler.json...")
    
    # Load pickle
    scaler = joblib.load(scaler_path)
    
    # Extract attributes
    scaler_data = {
        "data_min_": scaler.data_min_.tolist(),
        "data_max_": scaler.data_max_.tolist(),
        "data_range_": scaler.data_range_.tolist(),
        "feature_range": scaler.feature_range
    }
    
    # Write json
    json_path = os.path.join(ticker_dir, "scaler.json")
    with open(json_path, 'w') as f:
        json.dump(scaler_data, f, indent=2)
    
    # Upload to Supabase Storage
    print(f"[{ticker}] Uploading scaler.json to Supabase...")
    with open(json_path, 'rb') as f:
        supabase.storage.from_("models").upload(
            path=f"{ticker}/scaler.json",
            file=f,
            file_options={"upsert": "true", "content-type": "application/json"}
        )
    print(f"[{ticker}] Done")

print("\nAll scalers converted and uploaded successfully!")
