import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

export const SYSTEM_OWNER_EMAIL = 'corp@facilitapass.com.br'

/** Client com service role — ignora RLS. Nunca exportar isso pro browser. */
export function adminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export type Contexto = {
  supabase: SupabaseClient
  user: User
  ehDonoDoSistema: boolean
}

/**
 * Valida o Bearer token da requisição.
 *
 * Devolve o contexto autenticado OU um NextResponse de erro pronto pra
 * retornar. Use com `ehErro()` logo depois:
 *
 *   const ctx = await autenticar(req)
 *   if (ehErro(ctx)) return ctx
 *   // aqui ctx.user existe e é confiável
 */
export async function autenticar(req: NextRequest): Promise<Contexto | NextResponse> {
  const token = (req.headers.get('Authorization') ?? '').replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })

  const supabase = adminClient()
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })

  return { supabase, user, ehDonoDoSistema: user.email === SYSTEM_OWNER_EMAIL }
}

export function ehErro(x: Contexto | NextResponse): x is NextResponse {
  return x instanceof NextResponse
}

/**
 * Garante que o localizador pertence a quem está chamando — ou a alguém da
 * mesma empresa. Sem isso, qualquer usuário logado consegue ler/alterar a
 * reserva de qualquer outro só adivinhando o localizador.
 *
 * Devolve NextResponse quando deve bloquear, ou null quando pode seguir.
 *
 * `permitirAusente`: quando o localizador não existe na tabela `reservas`,
 * segue em frente em vez de bloquear. Necessário hoje nas rotas de emissão
 * porque a gravação da reserva em busca/page.tsx está dentro de um
 * try/catch vazio e pode falhar silenciosamente — bloquear aqui deixaria o
 * cliente sem conseguir pagar uma reserva que existe na WOOBA. Assim que a
 * gravação virar server-side e confiável, remover essa exceção e passar
 * todas as rotas a falhar fechado.
 */
export async function autorizarLocalizador(
  ctx: Contexto,
  localizador: string,
  opts: { permitirAusente?: boolean } = {},
): Promise<NextResponse | null> {
  const { supabase, user, ehDonoDoSistema } = ctx
  if (ehDonoDoSistema) return null

  const { data: reservas } = await supabase
    .from('reservas').select('user_id').eq('localizador', localizador).limit(1)
  const reserva = reservas?.[0]

  if (!reserva) {
    if (opts.permitirAusente) {
      console.warn('[AUTZ] Localizador sem reserva no banco, seguindo:', localizador, '| por:', user.email)
      return null
    }
    return NextResponse.json({ erro: 'Reserva não encontrada' }, { status: 404 })
  }

  if (reserva.user_id === user.id) return null

  const [{ data: chamador }, { data: dono }] = await Promise.all([
    supabase.from('usuarios_empresas').select('empresa_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('usuarios_empresas').select('empresa_id').eq('user_id', reserva.user_id).maybeSingle(),
  ])

  if (chamador?.empresa_id && dono?.empresa_id && chamador.empresa_id === dono.empresa_id) return null

  console.warn('[AUTZ] Acesso negado ao localizador', localizador, '| por:', user.email)
  return NextResponse.json({ erro: 'Você não tem permissão para acessar esta reserva.' }, { status: 403 })
}
