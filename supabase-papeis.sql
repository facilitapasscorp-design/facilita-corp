-- Fundação de permissões: papéis de usuário dentro da empresa.
--
-- Seguro rodar quantas vezes quiser: as colunas usam `if not exists`, as
-- funções usam `create or replace`, e cada policy é derrubada antes de ser
-- recriada. Rodar de novo num banco que já tem tudo não muda nada.
--
-- Três camadas:
--   1. Dono do sistema (corp@facilitapass.com.br) — já coberto pelas policies
--      "for all" com check de e-mail em supabase-admin.sql / supabase-politicas.sql
--      / supabase-chamados.sql. Não precisa de nada novo aqui.
--   2. Admin da empresa (papel_empresa='admin') — aprova/cancela/configura,
--      cria consultivos da própria empresa, e faz tudo que o consultivo faz.
--   3. Consultivo (papel_empresa='consultivo', padrão) — pesquisa, reserva,
--      gerencia os próprios passageiros. Não aprova, não cancela, não
--      configura política, não cria usuários.

-- ── Coluna de papel ──────────────────────────────────────────────────────
alter table usuarios_empresas add column if not exists papel_empresa text not null default 'consultivo'
  check (papel_empresa in ('admin', 'consultivo'));

-- ── Funções helper (security definer — evitam recursão de RLS ao ler a
-- própria linha em usuarios_empresas, mesmo padrão de get_empresa_do_usuario) ──
create or replace function get_papel_do_usuario()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select papel_empresa from usuarios_empresas where user_id = auth.uid() limit 1;
$$;

create or replace function is_admin_empresa()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from usuarios_empresas
    where user_id = auth.uid() and papel_empresa = 'admin'
  );
$$;

-- ── usuarios_empresas: admin da empresa enxerga os usuários da própria
-- empresa (além do próprio vínculo, já coberto por policy existente) ─────
drop policy if exists "Admin da empresa vê usuários da empresa" on usuarios_empresas;
create policy "Admin da empresa vê usuários da empresa"
  on usuarios_empresas for select
  using (is_admin_empresa() and empresa_id = get_empresa_do_usuario());

-- Defesa em profundidade: mesmo que algo tente inserir direto na tabela
-- (fora da rota de API), o banco não deixa um admin criar outro admin nem
-- criar usuário em empresa diferente da sua. A rota de criação já força
-- esses valores, mas a policy garante que não há furo se a rota for
-- contornada.
drop policy if exists "Admin da empresa cria consultivo na própria empresa" on usuarios_empresas;
create policy "Admin da empresa cria consultivo na própria empresa"
  on usuarios_empresas for insert
  with check (
    is_admin_empresa()
    and empresa_id = get_empresa_do_usuario()
    and papel_empresa = 'consultivo'
  );

-- ── reservas: admin da empresa vê as reservas de todos os usuários da sua
-- empresa, não só as próprias (consultivo continua só vendo/criando as
-- suas, via policy "Usuário vê suas próprias reservas" já existente) ─────
drop policy if exists "Admin da empresa vê reservas da empresa" on reservas;
create policy "Admin da empresa vê reservas da empresa"
  on reservas for select
  using (
    is_admin_empresa()
    and user_id in (select user_id from usuarios_empresas where empresa_id = get_empresa_do_usuario())
  );

-- Cancelamento é uma ação de admin. Troca a policy de update genérica por
-- uma que deixa o dono seguir atualizando a própria reserva (necessário
-- pro fluxo de emissão, que grava status='Emitida' e numero_bilhete), mas
-- bloqueia o próprio dono de gravar status='Cancelada' — isso só o admin
-- da empresa (ou o dono do sistema, via policy separada em
-- supabase-admin.sql) pode fazer. Fecha o furo de um consultivo cancelar
-- direto pelo client Supabase, contornando a rota da API.
drop policy if exists "Usuário atualiza suas próprias reservas" on reservas;

drop policy if exists "Atualiza reserva conforme papel" on reservas;
create policy "Atualiza reserva conforme papel"
  on reservas for update
  using (
    auth.uid() = user_id
    or (is_admin_empresa() and user_id in (select user_id from usuarios_empresas where empresa_id = get_empresa_do_usuario()))
  )
  with check (
    (auth.uid() = user_id and status <> 'Cancelada')
    or (is_admin_empresa() and user_id in (select user_id from usuarios_empresas where empresa_id = get_empresa_do_usuario()))
  );

-- ── Passageiros salvos ───────────────────────────────────────────────────
-- Essa tabela ainda não existe no sistema (nenhuma feature de "passageiros
-- salvos" foi construída até agora). Quando for criada, deve seguir o
-- mesmo padrão: RLS por user_id (cada usuário só vê/edita os seus,
-- incluindo admin — passageiro salvo não é um recurso da empresa, é
-- pessoal de quem cadastrou). Nada a ajustar aqui por enquanto.
