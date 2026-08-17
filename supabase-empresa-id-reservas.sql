-- Grava a empresa direto na reserva.
--
-- Antes, "de qual empresa é esta reserva?" era respondido olhando o vínculo
-- atual do usuário em usuarios_empresas. Isso significa que, se um funcionário
-- trocar de empresa, todo o histórico dele muda de dono junto e passa a
-- aparecer no relatório da empresa nova. Guardar empresa_id na própria reserva
-- congela o fato no momento em que ele aconteceu.
--
-- Seguro rodar mais de uma vez.

alter table reservas add column if not exists empresa_id uuid references empresas(id);

-- Preenche o histórico existente a partir do vínculo atual. Reservas de
-- usuários sem vínculo ficam com empresa_id nulo — elas já não apareciam para
-- nenhum admin de empresa antes desta mudança, então não há regressão.
update reservas r
   set empresa_id = ue.empresa_id
  from usuarios_empresas ue
 where ue.user_id = r.user_id
   and r.empresa_id is null;

create index if not exists reservas_empresa_id_idx on reservas (empresa_id);

-- ── Policies passam a usar a coluna ──────────────────────────────────────
-- Mesma regra de antes, só que lendo empresa_id da reserva em vez de refazer
-- o join com usuarios_empresas a cada verificação.

drop policy if exists "Admin da empresa vê reservas da empresa" on reservas;
create policy "Admin da empresa vê reservas da empresa"
  on reservas for select
  using (is_admin_empresa() and empresa_id = get_empresa_do_usuario());

drop policy if exists "Atualiza reserva conforme papel" on reservas;
create policy "Atualiza reserva conforme papel"
  on reservas for update
  using (
    auth.uid() = user_id
    or (is_admin_empresa() and empresa_id = get_empresa_do_usuario())
  )
  with check (
    (auth.uid() = user_id and status <> 'Cancelada')
    or (is_admin_empresa() and empresa_id = get_empresa_do_usuario())
  );
