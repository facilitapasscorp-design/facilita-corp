-- Contatos deixados pelo formulário do site institucional.
-- Roda inteiro no SQL Editor do Supabase. Pode rodar mais de uma vez.

create table if not exists leads (
  id            uuid        primary key default gen_random_uuid(),
  nome_completo text        not null,
  empresa       text        not null,
  email         text        not null,
  telefone      text        not null,
  gasto_mensal  text,
  created_at    timestamptz not null default now()
);

-- Colunas de acompanhamento (a tabela pode ser anterior a este arquivo)
alter table leads add column if not exists status     text not null default 'Novo';
alter table leads add column if not exists observacao text;

create index if not exists leads_created_at_idx on leads (created_at desc);

alter table leads enable row level security;

-- Quem visita o site não está logado: precisa poder inserir, e só inserir.
drop policy if exists "Visitante deixa contato" on leads;
create policy "Visitante deixa contato"
  on leads for insert
  to anon, authenticated
  with check (true);

-- Só o dono lê e mexe.
drop policy if exists "Admin gerencia leads" on leads;
create policy "Admin gerencia leads"
  on leads for all
  to authenticated
  using      ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br')
  with check ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br');
