import { NextRequest, NextResponse } from 'next/server'

/**
 * Guarda de servidor para as páginas internas.
 *
 * Antes disso, /admin, /painel e /busca eram protegidos só no navegador (um
 * useEffect que chamava router.replace). Os DADOS sempre estiveram protegidos
 * pela RLS do Supabase e, agora, pela autenticação das rotas de API — mas a
 * página em si era servida a qualquer um.
 *
 * O que este middleware faz de propósito é POUCO: ele só verifica se existe
 * um cookie de sessão do Supabase, sem validar o token. É uma escolha
 * consciente — validar aqui exigiria uma ida ao Supabase a cada navegação e,
 * pior, um erro de implementação trancaria usuários legítimos para fora do
 * sistema. A autorização de verdade continua onde ela é confiável: RLS no
 * banco e `autenticar()`/`autorizarLocalizador()` nas rotas de API.
 *
 * Em outras palavras: isto barra o anônimo, não o mal-intencionado. Quem
 * forjar um cookie vazio chega na página e não consegue ler um único dado.
 *
 * Nome do arquivo: o Next 16 depreciou a convenção `middleware` e renomeou
 * para `proxy` (node_modules/next/dist/docs — file-conventions/proxy.md).
 * Usar `middleware.ts` ainda funciona, mas emite aviso de depreciação.
 */
const ROTAS_PROTEGIDAS = ['/busca', '/painel', '/admin', '/relatorio']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const protegida = ROTAS_PROTEGIDAS.some(
    rota => pathname === rota || pathname.startsWith(`${rota}/`),
  )
  if (!protegida) return NextResponse.next()

  // O @supabase/ssr grava a sessão em cookies no formato sb-<ref>-auth-token
  // (podendo ser fatiado em .0, .1 quando o token é grande).
  const temSessao = req.cookies.getAll().some(
    c => c.name.startsWith('sb-') && c.name.includes('auth-token'),
  )

  if (!temSessao) {
    const url = req.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/busca/:path*', '/painel/:path*', '/admin/:path*', '/relatorio/:path*'],
}
