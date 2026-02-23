-- Migration to add extra features for enhanced LSTM model
-- Adding SMA_50 and Volume_MA5 columns

alter table public.daily_prices 
add column if not exists sma_50 numeric,
add column if not exists volume_ma5 numeric;

-- Rename ma5 to match naming conventions if preferred or just keep as is.
-- Based on requirements, user asked for SMA_20 and SMA_50. 
-- Existing schema has ma20, which is functionally equivalent to SMA_20.
