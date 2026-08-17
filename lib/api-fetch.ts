'use client'

import { createClient } from './supabase'

/**
 * Chamadas autenticadas para as rotas /api/*.
 *
 * Todas as rotas passaram a exigir Bearer token, então centralizar aqui
 * evita que uma chamada nova esqueça o header e só quebre em produção.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await createClient().auth.getSession()
  const token = data.session?.access_token
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function apiPost(rota: string, body?: unknown): Promise<Response> {
  return fetch(rota, {
    method: 'POST',
    headers: await authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export async function apiGet(rota: string): Promise<Response> {
  return fetch(rota, { headers: await authHeaders() })
}
