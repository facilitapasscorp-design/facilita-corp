import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase     = createClient(supabaseUrl, serviceKey)

    // Start of today in UTC — reservas created before this date are expired
    const hoje = new Date()
    hoje.setUTCHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from('reservas')
      .update({ status: 'Cancelada' })
      .eq('status', 'Ativa')
      .lt('created_at', hoje.toISOString())
      .select('id')

    if (error) {
      console.error('[CANCELAR-EXPIRADAS] Erro:', error.message)
      return NextResponse.json({ erro: error.message }, { status: 500 })
    }

    const canceladas = data?.length ?? 0
    console.log(`[CANCELAR-EXPIRADAS] ${canceladas} reserva(s) cancelada(s)`)
    return NextResponse.json({ canceladas })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
