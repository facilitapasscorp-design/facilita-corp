-- Tabela de chamados (solicitações de alteração/cancelamento/dúvida dos clientes)
create table if not exists chamados (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  reserva_id  uuid        references reservas(id) on delete set null,
  localizador text,
  tipo        text        not null check (tipo in ('Alteração', 'Cancelamento', 'Dúvida', 'Outro')),
  mensagem    text        not null,
  status      text        not null default 'Aberto'
              check (status in ('Aberto', 'Em andamento', 'Resolvido')),
  created_at  timestamptz not null default now()
);

-- Índice para busca por usuário
create index if not exists chamados_user_id_idx on chamados (user_id);

-- Row Level Security
alter table chamados enable row level security;

create policy "Usuário cria seus chamados"
  on chamados for insert
  with check (auth.uid() = user_id);

create policy "Usuário vê seus chamados"
  on chamados for select
  using (auth.uid() = user_id);

create policy "Admin gerencia chamados"
  on chamados for all
  using ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br')
  with check ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br');
