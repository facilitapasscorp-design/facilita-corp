-- Guarda o número do bilhete emitido pela WOOBA em cada reserva, pra exibir
-- no modal "Ver bilhete" do painel sem depender só de uma consulta ao vivo.
alter table reservas add column if not exists numero_bilhete text;
