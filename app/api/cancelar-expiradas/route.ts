import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { autenticar, ehErro } from '../../../lib/auth-api'

export async function GET(req: NextRequest) {
  const ctx = await autenticar(req)
  if (ehErro(ctx)) return ctx

  try {
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase     = createClient(supabaseUrl, serviceKey)

    // Start of today in UTC — reservas created before this date are expired
    const hoje = new Date()
    hoje.setUTCHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('reservas')
      .update({ status: 'Expirada' })
      .eq('status', 'Ativa')
      .lt('created_at', hoje.toISOString())
      .select('id')

    if (error) {
      console.error('[CANCELAR-EXPIRADAS] Erro:', error.message)
      return NextResponse.json({ erro: error.message }, { status: 500 })
    }

    const expiradas = data?.length ?? 0
    console.log(`[CANCELAR-EXPIRADAS] ${expiradas} reserva(s) marcada(s) como Expirada`)
    // `canceladas` fica no retorno só por compatibilidade com quem já consome.
    return NextResponse.json({ expiradas, canceladas: expiradas })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
