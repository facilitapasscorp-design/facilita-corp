import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = 'corp@facilitapass.com.br'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(request: NextRequest) {
  // Verifica se o chamador é o admin via Bearer token
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 })

  const supabase = adminClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user || user.email !== ADMIN_EMAIL) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 })
  }

  const { nome, email, senha, empresa_id } = await request.json()
  if (!nome || !email || !senha || !empresa_id) {
    return NextResponse.json({ erro: 'Preencha todos os campos.' }, { status: 400 })
  }

  // Cria o usuário no Auth
  const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (createErr) return NextResponse.json({ erro: createErr.message }, { status: 400 })

  // Vincula o usuário à empresa
  const { error: linkErr } = await supabase.from('usuarios_empresas').insert({
    user_id: userData.user.id,
    empresa_id,
    nome,
    email,
  })
  if (linkErr) return NextResponse.json({ erro: linkErr.message }, { status: 400 })

  return NextResponse.json({ sucesso: true, user_id: userData.user.id })
}
