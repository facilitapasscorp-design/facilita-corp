-- ── Empresas ────────────────────────────────────────────────────────────
create table if not exists empresas (
  id        uuid        primary key default gen_random_uuid(),
  nome      text        not null,
  cnpj      text,
  telefone  text,
  email     text,
  ativa     boolean     not null default true,
  created_at timestamptz not null default now()
);

alter table empresas enable row level security;

-- Admin acessa tudo
create policy "Admin gerencia empresas"
  on empresas for all
  using ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br')
  with check ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br');

-- Função auxiliar para evitar recursão no RLS
create or replace function get_empresa_do_usuario()
returns uuid
language sql
security definer
set search_path = public
as $$
  select empresa_id from usuarios_empresas where user_id = auth.uid() limit 1;
$$;

-- Usuários veem apenas sua empresa
create policy "Usuário vê sua empresa"
  on empresas for select
  using (id = get_empresa_do_usuario());


-- ── Usuários × Empresas ──────────────────────────────────────────────────
create table if not exists usuarios_empresas (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete cascade,
  empresa_id  uuid        not null references empresas(id) on delete cascade,
  nome        text,
  email       text,
  created_at  timestamptz not null default now(),
  unique (user_id)
);

create index if not exists usuarios_empresas_empresa_id_idx on usuarios_empresas (empresa_id);

alter table usuarios_empresas enable row level security;

create policy "Admin gerencia usuarios_empresas"
  on usuarios_empresas for all
  using ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br')
  with check ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br');

create policy "Usuário vê seu próprio vínculo"
  on usuarios_empresas for select
  using (user_id = auth.uid());


-- ── Admin vê todas as reservas ───────────────────────────────────────────
-- (adiciona policy na tabela criada pelo supabase-reservas.sql)
create policy "Admin vê todas as reservas"
  on reservas for all
  using ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br')
  with check ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br');
