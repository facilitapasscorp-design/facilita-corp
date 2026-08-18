-- Base de passageiros da agência.
-- A lista pertence à empresa cliente (não ao usuário que digitou), para que
-- ela sobreviva à troca de quem compra. O login master da Facilita Pass
-- enxerga e gerencia todas as empresas.
-- Roda inteiro no SQL Editor do Supabase. Pode rodar mais de uma vez.

create table if not exists passageiros (
  id         uuid        primary key default gen_random_uuid(),
  empresa_id uuid        not null references empresas(id) on delete cascade,
  criado_por uuid        references auth.users(id) on delete set null,
  nome       text        not null,
  sobrenome  text        not null,
  cpf        text,
  nascimento date,
  email      text,
  telefone   text,
  sexo       text        check (sexo in ('M', 'F')),
  tipo       text        not null default 'ADT' check (tipo in ('ADT', 'CHD', 'INF')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists passageiros_empresa_idx on passageiros (empresa_id, nome);

-- Um CPF por empresa. Bebê de colo costuma não ter CPF, por isso o índice
-- ignora as linhas sem CPF em vez de bloquear a segunda delas.
create unique index if not exists passageiros_empresa_cpf_idx
  on passageiros (empresa_id, cpf) where cpf is not null;

alter table passageiros enable row level security;

drop policy if exists "Empresa gerencia seus passageiros" on passageiros;
create policy "Empresa gerencia seus passageiros"
  on passageiros for all
  to authenticated
  using      (empresa_id = get_empresa_do_usuario())
  with check (empresa_id = get_empresa_do_usuario());

drop policy if exists "Admin gerencia passageiros" on passageiros;
create policy "Admin gerencia passageiros"
  on passageiros for all
  to authenticated
  using      ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br')
  with check ((auth.jwt() ->> 'email') = 'corp@facilitapass.com.br');

-- A reserva passa a guardar todos os passageiros, e não só o primeiro adulto.
alter table reservas add column if not exists passageiros jsonb;
