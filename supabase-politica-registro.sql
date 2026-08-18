-- Registra a violação de política na reserva.
--
-- Até aqui o sistema calculava a violação na busca, mostrava o selo amarelo
-- e descartava. Ninguém conseguia responder "quantas viagens saíram fora da
-- política este mês?" — que é exatamente o que a empresa cliente pensa que
-- está comprando.
--
-- Seguro rodar mais de uma vez.

alter table reservas add column if not exists fora_politica boolean not null default false;

-- Guarda um registro por trecho, no formato:
--   [{ "trecho": "ida",
--      "motivos": ["valor R$ 2.100 acima do limite de R$ 1.500"],
--      "categoria": "Reunião marcada em cima da hora",
--      "detalhe": "" }]
--
-- jsonb em vez de colunas soltas porque uma viagem pode ter duas violações
-- (ida e volta) com justificativas diferentes.
alter table reservas add column if not exists politica_motivos jsonb;

-- Serve o filtro do relatório: "viagens fora da política desta empresa".
create index if not exists reservas_empresa_politica_idx
  on reservas (empresa_id, fora_politica);
