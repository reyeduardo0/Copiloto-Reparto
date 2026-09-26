create table if not exists public.copiloto_datos (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  clave text not null,
  datos jsonb not null,
  actualizado timestamptz not null default now(),
  primary key (user_id, clave)
);
alter table public.copiloto_datos enable row level security;
drop policy if exists "ver lo mio" on public.copiloto_datos;
drop policy if exists "crear lo mio" on public.copiloto_datos;
drop policy if exists "cambiar lo mio" on public.copiloto_datos;
drop policy if exists "borrar lo mio" on public.copiloto_datos;
create policy "ver lo mio" on public.copiloto_datos for select to authenticated using ((select auth.uid()) = user_id);
create policy "crear lo mio" on public.copiloto_datos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cambiar lo mio" on public.copiloto_datos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "borrar lo mio" on public.copiloto_datos for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.copiloto_datos to authenticated;
revoke all on public.copiloto_datos from anon;
