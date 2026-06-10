create table if not exists politicas_viagem (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  limite_valor_nacional numeric(10,2),
  limite_valor_internacional numeric(10,2),
  antecedencia_minima_dias integer,
  familias_permitidas text[],
  max_parcelas integer,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  unique(empresa_id)
);
alter table politicas_viagem enable row level security;
create policy "Admin gerencia politicas" on politicas_viagem for all
  using ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br')
  with check ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br');
create policy "Usuário vê política da sua empresa" on politicas_viagem for select
  using (empresa_id = get_empresa_do_usuario());
