-- Nina Book's — preparação da nuvem (Supabase)
-- Cole tudo no SQL Editor do Supabase e clique em "Run". Pode rodar mais de uma vez.

-- 1) Tabela única com todos os registros do app (livros, sessões, notas…)
create table if not exists public.records (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tbl         text not null,
  id          text not null,
  data        jsonb,
  deleted     boolean not null default false,
  modified_at timestamptz not null default clock_timestamp(),
  primary key (user_id, tbl, id)
);
create index if not exists records_user_modified on public.records (user_id, modified_at);

-- o horário de modificação é sempre o do servidor
create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.modified_at := clock_timestamp();
  return new;
end $$;
drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
  for each row execute function public.records_touch();

-- 2) Segurança: cada pessoa só enxerga e altera os próprios dados
alter table public.records enable row level security;
drop policy if exists "records: só a dona" on public.records;
create policy "records: só a dona" on public.records
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) Armazenamento de fotos, áudios e vídeos (pasta por pessoa)
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do nothing;

drop policy if exists "media: só a dona" on storage.objects;
create policy "media: só a dona" on storage.objects
  for all to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
