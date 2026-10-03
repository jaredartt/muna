-- Our own name for a product (often English: "Mint" for Minze), searched together with the real name.
alter table public.products add column if not exists nickname text check (nickname is null or char_length(nickname) <= 80);
