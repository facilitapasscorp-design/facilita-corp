-- Suporte a reservas com múltiplos localizadores (ida/volta de companhias
-- diferentes): cada localizador vira um registro próprio em `reservas`,
-- agrupado por `grupo_reserva` quando fazem parte da mesma viagem.
alter table reservas add column if not exists companhia text;
alter table reservas add column if not exists grupo_reserva uuid;

-- Qual trecho da viagem este localizador cobre — necessário pra rotular
-- "Ida"/"Volta" na tela depois que os dois registros já foram salvos.
alter table reservas add column if not exists trecho text check (trecho in ('ida', 'volta'));

-- Índice para buscar todos os localizadores de um mesmo grupo
create index if not exists reservas_grupo_reserva_idx on reservas (grupo_reserva);
