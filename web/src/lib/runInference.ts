import * as tf from "@tensorflow/tfjs";
import { DailyPrice, ForecastResult } from "./types";
import { supabase } from "./supabase";

/**
 * Scales a 2D array of features using min/max values.
 * Returns a 2D array of scaled values between 0 and 1.
 */
function minMaxScaler(data: number[][], minValues: number[], maxValues: number[]): number[][] {
    return data.map(row =>
        row.map((val, colIdx) => {
            const min = minValues[colIdx];
            const max = maxValues[colIdx];
            if (max - min === 0) return 0;
            return (val - min) / (max - min);
        })
    );
}

/**
 * Runs client-side inference using the pre-trained model for the specific ticker.
 */
export async function runInference(ticker: string, recentData: DailyPrice[]): Promise<ForecastResult[]> {
    // 1. We need exactly 7 days of data for the sequence (as trained in python)
    if (recentData.length < 7) {
        throw new Error("Not enough data to run inference. Need at least 7 days.");
    }

    const last7Days = recentData.slice(-7);

    // 2. Fetch the scaler min/max values for this specific ticker from Supabase storage
    const { data: scalerBlob, error: scalerError } = await supabase
        .storage
        .from("models")
        .download(`${ticker}/scaler.json`);

    if (scalerError || !scalerBlob) {
        throw new Error(`Failed to download scaler for ${ticker}: ${scalerError?.message}`);
    }

    const scalerJson = JSON.parse(await scalerBlob.text());
    const minValues = scalerJson.data_min_;
    const maxValues = scalerJson.data_max_;

    // 3. Extract the 10 features exactly as they were used in Python training
    // Features: ['close', 'returns', 'ma5', 'ma20', 'rsi14', 'macd', 'bb_upper', 'bb_lower', 'volatility', 'volume_ma5']
    const rawFeatures: number[][] = last7Days.map(day => [
        day.close,
        day.returns || 0,
        day.ma5 || day.close,
        day.ma20 || day.close,
        day.rsi14 || 50,
        day.macd || 0,
        day.bb_upper || day.close,
        day.bb_lower || day.close,
        day.volatility || 0,
        day.volume_ma5 || 0
    ]);

    // 4. Scale the features
    const scaledFeatures = minMaxScaler(rawFeatures, minValues, maxValues);

    // 5. Load the model from Supabase Storage
    // We use the public URL to directly load it into TF.js
    const { data: publicUrlData } = supabase.storage.from("models").getPublicUrl(`${ticker}/model.json`);
    const modelUrl = publicUrlData.publicUrl;

    const model = await tf.loadLayersModel(modelUrl);

    // 6. Predict
    // Shape must be [batch_size, time_steps, features] -> [1, 7, 10]
    const inputTensor = tf.tensor3d([scaledFeatures]);
    const predictionTensor = model.predict(inputTensor) as tf.Tensor;

    // predictionTensor shape is [1, 3]
    const scaledPredictions = await predictionTensor.array() as number[][];
    const scaledPrices = scaledPredictions[0]; // The 3 predicted values

    model.dispose();
    inputTensor.dispose();
    predictionTensor.dispose();

    // 7. Inverse transform the predicted close prices
    // The 'close' feature was the first column (index 0) in the scaler
    const closeMin = minValues[0];
    const closeMax = maxValues[0];

    const denormalizedPrices = scaledPrices.map(scaledVal =>
        scaledVal * (closeMax - closeMin) + closeMin
    );

    // 8. Generate future dates for the forecast (ignoring weekends simply for this demo context, or just adding 1 day)
    const lastDate = new Date(recentData[recentData.length - 1].date);
    const forecastResults: ForecastResult[] = [];

    let currentDate = new Date(lastDate);
    for (let i = 0; i < 3; i++) {
        // Add 1 day
        currentDate.setDate(currentDate.getDate() + 1);
        // Skip weekends
        if (currentDate.getDay() === 6) currentDate.setDate(currentDate.getDate() + 2); // Saturday -> Monday
        if (currentDate.getDay() === 0) currentDate.setDate(currentDate.getDate() + 1); // Sunday -> Monday

        forecastResults.push({
            date: currentDate.toISOString().split('T')[0],
            predictedClose: parseFloat(denormalizedPrices[i].toFixed(2))
        });
    }

    return forecastResults;
}
