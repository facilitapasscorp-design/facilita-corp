-- Tabela de reservas dos clientes
create table if not exists reservas (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users(id) on delete cascade,
  localizador     text        not null,
  origem          text        not null,
  destino         text        not null,
  data_voo        date,
  passageiro_nome text,
  valor           numeric(10, 2),
  status          text        not null default 'Ativa'
                  check (status in ('Ativa', 'Emitida', 'Cancelada', 'Expirada')),
  created_at      timestamptz not null default now()
);

-- Índice para busca por usuário
create index if not exists reservas_user_id_idx on reservas (user_id);

-- Row Level Security
alter table reservas enable row level security;

create policy "Usuário vê suas próprias reservas"
  on reservas for select
  using (auth.uid() = user_id);

create policy "Usuário insere suas próprias reservas"
  on reservas for insert
  with check (auth.uid() = user_id);

create policy "Usuário atualiza suas próprias reservas"
  on reservas for update
  using (auth.uid() = user_id);
