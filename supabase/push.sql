-- Nina Book's — notificações diárias (rode uma vez no SQL Editor, depois do setup.sql)
create extension if not exists pgcrypto with schema extensions;

-- guarda só o "hash" da senha usada pelo envio automático (a senha fica no GitHub)
create table if not exists public.push_config (id int primary key default 1, secret_hash text not null);
alter table public.push_config enable row level security; -- sem políticas: ninguém lê pela API
insert into public.push_config (id, secret_hash)
values (1, 'ea5aa7cc793e6898aeae2e55a36890555f42452b0ea04009dc1439c3f184cf43')
on conflict (id) do update set secret_hash = excluded.secret_hash;

-- devolve os aparelhos que pediram notificação (só para quem tiver a senha do envio)
create or replace function public.nina_push_targets(secret text)
returns table (id text, data jsonb)
language sql security definer set search_path = public, extensions
as $$
  select r.id, r.data from public.records r
  where r.tbl = 'prefs' and r.id like 'push:%' and not r.deleted and r.data ? 'subscription'
    and exists (select 1 from public.push_config c where c.secret_hash = encode(extensions.digest(secret, 'sha256'), 'hex'));
$$;
revoke all on function public.nina_push_targets(text) from public;
grant execute on function public.nina_push_targets(text) to anon, authenticated;
