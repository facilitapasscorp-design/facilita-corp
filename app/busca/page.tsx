'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '../../lib/supabase'

export default function Busca() {
  const router = useRouter()
  const [tipo, setTipo] = useState<'ida' | 'idavolta' | 'multiplos'>('idavolta')
  const [origem, setOrigem] = useState('')
  const [destino, setDestino] = useState('')
  const [dataIda, setDataIda] = useState('')
  const [dataVolta, setDataVolta] = useState('')
  const [passageiros, setPassageiros] = useState(1)
  const [classe, setClasse] = useState('Y')
  const [bagagem, setBagagem] = useState('sem')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [voos, setVoos] = useState<any>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/')
    })
  }, [router])

  async function buscarVoos() {
    if (!origem || !destino || !dataIda) {
      setErro('Preencha origem, destino e data de ida.')
      return
    }
    setCarregando(true)
    setErro('')
    setVoos(null)

    const res = await fetch('/api/buscar-voos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origem, destino, dataIda, dataVolta, passageiros, classe, tipo }),
    })

    const data = await res.json()
    setCarregando(false)

    if (data.erro) {
      setErro(data.erro)
    } else {
      setVoos(data.voos)
    }
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1a2744' }}>
      {/* Header */}
      <div className="px-8 py-5 flex items-center justify-between">
        <Image src="/logo.png" alt="Facilita Pass" width={140} height={46} style={{ objectFit: 'contain' }} />
        <button
          onClick={async () => { await createClient().auth.signOut(); router.replace('/') }}
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          Sair
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-white text-2xl font-light mb-6">Buscar passagens</h2>

        <div className="bg-white rounded-2xl p-6 space-y-5">
          {/* Tipo de viagem */}
          <div className="flex gap-2">
            {[
              { valor: 'idavolta', label: 'Ida e volta' },
              { valor: 'ida', label: 'Só ida' },
              { valor: 'multiplos', label: 'Múltiplos destinos' },
            ].map((op) => (
              <button
                key={op.valor}
                onClick={() => setTipo(op.valor as any)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  tipo === op.valor ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={tipo === op.valor ? { backgroundColor: '#1a2744' } : {}}
              >
                {op.label}
              </button>
            ))}
          </div>

          {/* Origem e Destino */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Origem</label>
              <input
                type="text"
                placeholder="Ex: GRU"
                value={origem}
                onChange={(e) => setOrigem(e.target.value.toUpperCase())}
                className="mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Destino</label>
              <input
                type="text"
                placeholder="Ex: GIG"
                value={destino}
                onChange={(e) => setDestino(e.target.value.toUpperCase())}
                className="mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Data de ida</label>
              <input
                type="date"
                value={dataIda}
                onChange={(e) => setDataIda(e.target.value)}
                className="mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {tipo === 'idavolta' && (
              <div>
                <label className="text-sm font-medium text-gray-700">Data de volta</label>
                <input
                  type="date"
                  value={dataVolta}
                  onChange={(e) => setDataVolta(e.target.value)}
                  className="mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Passageiros, Classe, Bagagem */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Passageiros</label>
              <select
                value={passageiros}
                onChange={(e) => setPassageiros(Number(e.target.value))}
                className="mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value={1}>1 passageiro</option>
                <option value={2}>2 passageiros</option>
                <option value={3}>3 passageiros</option>
                <option value={4}>4 passageiros</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Classe</label>
              <select
                value={classe}
                onChange={(e) => setClasse(e.target.value)}
                className="mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Y">Econômica</option>
                <option value="C">Executiva</option>
                <option value="F">Primeira classe</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Bagagem</label>
              <select
                value={bagagem}
                onChange={(e) => setBagagem(e.target.value)}
                className="mt-1 w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="sem">Sem bagagem</option>
                <option value="1">1 bagagem (23kg)</option>
                <option value="2">2 bagagens (23kg)</option>
              </select>
            </div>
          </div>

          {erro && <p className="text-red-500 text-sm">{erro}</p>}

          <button
            onClick={buscarVoos}
            disabled={carregando}
            className="w-full py-3 rounded-xl text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#1a2744' }}
          >
            {carregando ? 'Buscando voos...' : 'Buscar voos'}
          </button>
        </div>

        {/* Resultados */}
        {voos && (
          <div className="mt-6 space-y-3">
            <h3 className="text-white text-lg font-light">Resultados</h3>
            <pre className="bg-white rounded-2xl p-4 text-xs overflow-auto max-h-96">
              {JSON.stringify(voos, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}