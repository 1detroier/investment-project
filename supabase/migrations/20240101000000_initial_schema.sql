create table if not exists public.daily_prices (
  id bigint generated always as identity primary key,
  ticker text not null,
  date date not null,
  open numeric,
  high numeric,
  low numeric,
  close numeric not null,
  volume bigint,
  returns numeric,
  ma5 numeric,
  ma20 numeric,
  rsi14 numeric,
  macd numeric,
  bb_upper numeric,
  bb_lower numeric,
  volatility numeric,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.daily_prices add constraint daily_prices_ticker_date_key unique (ticker, date);

create index if not exists idx_daily_prices_ticker on public.daily_prices(ticker);
create index if not exists idx_daily_prices_date on public.daily_prices(date desc);

alter table public.daily_prices enable row level security;

create policy "Allow public read access to daily_prices" 
  on public.daily_prices for select 
  to public 
  using (true);

create policy "Allow service role insert access to daily_prices" 
  on public.daily_prices for insert 
  to service_role 
  with check (true);

insert into storage.buckets (id, name, public) 
values ('models', 'models', true)
on conflict (id) do nothing;

create policy "Allow public read access to models bucket"
  on storage.objects for select
  to public
  using ( bucket_id = 'models' );

create policy "Allow service role insert access to models bucket"
  on storage.objects for insert
  to service_role
  with check ( bucket_id = 'models' );

create policy "Allow service role update access to models bucket"
  on storage.objects for update
  to service_role
  using ( bucket_id = 'models' );
