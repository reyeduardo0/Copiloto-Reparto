-- Copiloto de reparto · contador diario de consultas a la IA (una fila por usuario y día).
-- Ejecutar una vez en SQL Editor, después de supabase-tabla.sql.
create table if not exists public.copiloto_ia_uso (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null default ((now() at time zone 'Europe/Madrid'))::date,
  llamadas integer not null default 0,
  primary key (user_id, dia)
);
alter table public.copiloto_ia_uso enable row level security;
drop policy if exists "ver mi uso de ia" on public.copiloto_ia_uso;
create policy "ver mi uso de ia" on public.copiloto_ia_uso for select to authenticated using ((select auth.uid()) = user_id);
-- cada usuario solo puede leer su contador; solo la función lo incrementa
revoke all on public.copiloto_ia_uso from anon, authenticated;
grant select on public.copiloto_ia_uso to authenticated;

-- Suma una consulta al usuario que llama y devuelve cuántas lleva hoy.
create or replace function public.copiloto_ia_contar()
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  u uuid := auth.uid();
  d date := (now() at time zone 'Europe/Madrid')::date;
  n integer;
begin
  if u is null then
    raise exception 'sin sesion';
  end if;
  insert into public.copiloto_ia_uso as t (user_id, dia, llamadas)
  values (u, d, 1)
  on conflict (user_id, dia) do update set llamadas = t.llamadas + 1
  returning t.llamadas into n;
  return n;
end;
$$;
revoke all on function public.copiloto_ia_contar() from public, anon;
grant execute on function public.copiloto_ia_contar() to authenticated;
