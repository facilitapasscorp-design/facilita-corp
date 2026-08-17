import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes, randomInt } from 'crypto'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

function gerarSenhaProvisoria(): string {
  const base = randomBytes(9).toString('base64').replace(/[+/=]/g, '').slice(0, 10)
  const simbolo = '!@#$%&*'[randomInt(7)]
  const digito = String(randomInt(10))
  return `${base}${digito}${simbolo}`
}

/**
 * Envia a senha provisória por e-mail pro usuário recém-criado.
 *
 * TODO: o Resend ainda não está configurado nesta conta. Para ativar:
 *   1. `npm install resend`
 *   2. Adicionar RESEND_API_KEY no .env.local (e nas envs de produção)
 *   3. Descomentar o bloco abaixo
 * Até lá, a senha só é devolvida na resposta da API pro admin copiar.
 */
async function enviarEmailBoasVindas(dados: { nome: string; email: string; senha: string; empresa: string }) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[CRIAR-CONSULTIVO] RESEND_API_KEY não configurada — e-mail não enviado.', { email: dados.email })
    return
  }
  // const { Resend } = await import('resend')
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({
  //   from: 'Facilita Pass <acesso@facilitapass.com.br>',
  //   to: dados.email,
  //   subject: `Seu acesso à Facilita Pass — ${dados.empresa}`,
  //   html: `
  //     <p>Olá, ${dados.nome}!</p>
  //     <p>Sua conta na Facilita Pass foi criada por um administrador da ${dados.empresa}.</p>
  //     <p><strong>E-mail:</strong> ${dados.email}<br/><strong>Senha provisória:</strong> ${dados.senha}</p>
  //     <p>Recomendamos trocar a senha no primeiro acesso.</p>
  //   `,
  // })
}

export async function POST(request: NextRequest) {
  // Autenticação: exige um usuário logado com token válido.
  const authHeader = request.headers.get('Authorization') ?? ''
  const accessToken = authHeader.replace('Bearer ', '').trim()
  if (!accessToken) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 })

  const supabase = adminClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(accessToken)
  if (authErr || !user) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 })

  // Autorização: só admin da empresa cria consultivo — e só da PRÓPRIA
  // empresa. O dono do sistema tem sua própria rota (/api/admin/criar-usuario)
  // com controle total; esta aqui é deliberadamente restrita.
  const { data: chamador } = await supabase
    .from('usuarios_empresas').select('papel_empresa, empresa_id').eq('user_id', user.id).maybeSingle()
  if (!chamador || chamador.papel_empresa !== 'admin') {
    return NextResponse.json({ erro: 'Apenas administradores da empresa podem criar usuários.' }, { status: 403 })
  }

  const { nome, email } = await request.json()
  if (!nome || !email) {
    return NextResponse.json({ erro: 'Preencha nome e e-mail.' }, { status: 400 })
  }

  const senha = gerarSenhaProvisoria()

  // Cria o usuário no Auth
  const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (createErr) return NextResponse.json({ erro: createErr.message }, { status: 400 })

  // Vincula à MESMA empresa do admin que está criando, sempre como
  // 'consultivo' — esses dois valores NUNCA vêm do corpo da requisição,
  // são sempre derivados do chamador autenticado. Não há caminho pelo
  // qual um admin de empresa consiga criar outro admin ou criar usuário
  // fora da própria empresa através desta rota.
  const { error: linkErr } = await supabase.from('usuarios_empresas').insert({
    user_id: userData.user.id,
    empresa_id: chamador.empresa_id,
    nome,
    email,
    papel_empresa: 'consultivo',
  })
  if (linkErr) {
    // Reverte a criação do usuário no Auth se o vínculo falhar, pra não
    // deixar uma conta órfã sem empresa.
    await supabase.auth.admin.deleteUser(userData.user.id)
    return NextResponse.json({ erro: linkErr.message }, { status: 400 })
  }

  const { data: empresaRow } = await supabase.from('empresas').select('nome').eq('id', chamador.empresa_id).maybeSingle()
  enviarEmailBoasVindas({ nome, email, senha, empresa: empresaRow?.nome ?? '' })
    .catch(err => console.error('[CRIAR-CONSULTIVO] Falha ao enviar e-mail de boas-vindas:', err))

  return NextResponse.json({ sucesso: true, user_id: userData.user.id, senha_provisoria: senha })
}
