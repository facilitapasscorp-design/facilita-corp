import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { gerarAccessCode } from '../../../lib/wooba-auth'

const BASE_URL_SANDBOX = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'
const SYSTEM_OWNER_EMAIL = 'corp@facilitapass.com.br'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  try {
    // Autenticação: exige um usuário logado com token válido.
    const authHeader = req.headers.get('Authorization') ?? ''
    const accessToken = authHeader.replace('Bearer ', '').trim()
    if (!accessToken) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 })

    const supabase = adminClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken)
    if (authErr || !user) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 })

    const { localizador } = await req.json()
    if (!localizador) {
      return NextResponse.json({ erro: 'Localizador obrigatório' }, { status: 400 })
    }

    // Autorização: cancelamento é ação de admin da empresa (ou do dono do
    // sistema) — nunca de um consultivo, mesmo que a reserva seja dele.
    const ehDonoDoSistema = user.email === SYSTEM_OWNER_EMAIL

    if (!ehDonoDoSistema) {
      // Checa o papel do chamador ANTES de sequer olhar a reserva — um
      // consultivo é bloqueado igual, exista ou não o localizador (evita
      // vazar pra ele se um localizador existe ou não).
      const { data: chamador } = await supabase
        .from('usuarios_empresas').select('papel_empresa, empresa_id').eq('user_id', user.id).maybeSingle()
      if (!chamador || chamador.papel_empresa !== 'admin') {
        return NextResponse.json({ erro: 'Apenas administradores da empresa podem cancelar reservas.' }, { status: 403 })
      }

      const { data: reserva } = await supabase
        .from('reservas').select('user_id').eq('localizador', localizador).maybeSingle()
      if (!reserva) return NextResponse.json({ erro: 'Reserva não encontrada' }, { status: 404 })

      // Reserva precisa pertencer a alguém da MESMA empresa do admin —
      // impede cancelar reserva de outra empresa mesmo sendo admin.
      const { data: dono } = await supabase
        .from('usuarios_empresas').select('empresa_id').eq('user_id', reserva.user_id).maybeSingle()
      if (!dono || dono.empresa_id !== chamador.empresa_id) {
        return NextResponse.json({ erro: 'Você não tem permissão para cancelar esta reserva.' }, { status: 403 })
      }
    }

    const BASE  = process.env.WOOBA_URL_PRODUCAO ?? BASE_URL_SANDBOX
    const login = process.env.WOOBA_LOGIN_PRODUCAO ?? process.env.WOOBA_LOGIN!
    const senha = process.env.WOOBA_SENHA_PRODUCAO ?? process.env.WOOBA_SENHA!
    const token = process.env.WOOBA_TOKEN!

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Developer-Token': token,
      'Developer-Access-Code': gerarAccessCode(),
    }

    const body = JSON.stringify({
      Login: login,
      Senha: senha,
      ClienteId: 0,
      Localizador: localizador,
    })

    const res  = await fetch(`${BASE}/Cancelar`, { method: 'POST', headers, body })
    const data = await res.json()

    console.log('[CANCELAR] Localizador:', localizador, '| por:', user.email, '| Exception:', data.Exception?.Message ?? null)

    if (data.Exception) {
      return NextResponse.json({ erro: data.Exception.Message }, { status: 400 })
    }

    // Grava o cancelamento aqui, com a service role — antes era o próprio
    // frontend que gravava com o client do usuário, mas a RLS agora
    // bloqueia o dono da reserva de setar status='Cancelada' direto
    // (só admin/dono do sistema podem), então centraliza a escrita aqui,
    // já validado acima.
    await supabase.from('reservas').update({ status: 'Cancelada' }).eq('localizador', localizador)

    return NextResponse.json({ sucesso: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
