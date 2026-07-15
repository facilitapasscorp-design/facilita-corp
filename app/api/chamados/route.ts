import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TIPOS_VALIDOS = ['Alteração', 'Cancelamento', 'Dúvida', 'Outro']

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export async function POST(request: NextRequest) {
  // Verifica se o chamador está autenticado via Bearer token
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 })

  const supabase = adminClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ erro: 'Não autorizado' }, { status: 403 })

  const { reserva_id, localizador, tipo, mensagem } = await request.json()
  if (!tipo || !TIPOS_VALIDOS.includes(tipo)) {
    return NextResponse.json({ erro: 'Tipo de solicitação inválido.' }, { status: 400 })
  }
  if (!mensagem || !String(mensagem).trim()) {
    return NextResponse.json({ erro: 'Descreva sua solicitação.' }, { status: 400 })
  }

  const { data: chamado, error: insertErr } = await supabase.from('chamados').insert({
    user_id: user.id,
    reserva_id: reserva_id ?? null,
    localizador: localizador ?? null,
    tipo,
    mensagem,
  }).select().single()
  if (insertErr) return NextResponse.json({ erro: insertErr.message }, { status: 400 })

  const { data: usuarioEmpresa } = await supabase
    .from('usuarios_empresas')
    .select('nome, empresas(nome)')
    .eq('user_id', user.id)
    .maybeSingle()

  // O e-mail é best-effort: o chamado já foi salvo acima, então uma falha
  // aqui (ou o Resend ainda não configurado) nunca deve derrubar a resposta.
  enviarEmailNotificacaoChamado({
    localizador: localizador || '—',
    empresa: (usuarioEmpresa?.empresas as unknown as { nome: string } | null)?.nome ?? '—',
    usuario: usuarioEmpresa?.nome ?? user.email ?? '—',
    tipo,
    mensagem,
  }).catch(err => console.error('[CHAMADOS] Falha ao enviar e-mail de notificação:', err))

  return NextResponse.json({ sucesso: true, chamado })
}

/**
 * Notifica corp@facilitapass.com.br sobre um novo chamado.
 *
 * TODO: o Resend ainda não está configurado nesta conta. Para ativar:
 *   1. `npm install resend`
 *   2. Adicionar RESEND_API_KEY no .env.local (e nas envs de produção)
 *   3. Descomentar o bloco abaixo
 * Até lá, esta função só loga os dados do chamado no servidor.
 */
async function enviarEmailNotificacaoChamado(dados: {
  localizador: string
  empresa: string
  usuario: string
  tipo: string
  mensagem: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[CHAMADOS] RESEND_API_KEY não configurada — e-mail não enviado. Dados do chamado:', dados)
    return
  }

  // const { Resend } = await import('resend')
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // await resend.emails.send({
  //   from: 'Facilita Pass <chamados@facilitapass.com.br>',
  //   to: 'corp@facilitapass.com.br',
  //   subject: `Novo chamado (${dados.tipo}) — ${dados.empresa}`,
  //   html: `
  //     <p><strong>Empresa:</strong> ${dados.empresa}</p>
  //     <p><strong>Usuário:</strong> ${dados.usuario}</p>
  //     <p><strong>Localizador:</strong> ${dados.localizador}</p>
  //     <p><strong>Tipo:</strong> ${dados.tipo}</p>
  //     <p><strong>Mensagem:</strong></p>
  //     <p>${dados.mensagem.replace(/\n/g, '<br/>')}</p>
  //   `,
  // })
}
