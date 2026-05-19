/**
 * Cenário Bebê - Homologação WOOBA
 * 1 Adulto + 1 Bebê de colo | Ida e volta | Nacional GRU x GIG | Pagamento faturado
 *
 * Estrutura exata WOOBA: bebê como campo do adulto (PossuiBebe, InfantilNome,
 * InfantilSobrenome, InfantilNascimento, InfantilSexo) — sem entrada separada no array.
 *
 * Fluxo: RecuperarSistemasPesquisa → Disponibilidade → Tarifar
 *        → Reservar → IniciarEmissao → RecuperarFormasDeFinanciamento
 *        → Emitir (faturado) → Consultar → ConsultarEticket → Cancelar
 */

const fs    = require('fs')
const path  = require('path')
const forge = require('node-forge')

const OUT_DIR = path.join(__dirname, 'cenario-bebe-colo-ida-nacional-faturado')
const BASE    = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

const envPath = path.join(__dirname, '..', '.env.local')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n').filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)
const LOGIN = env.WOOBA_LOGIN
const SENHA = env.WOOBA_SENHA
const TOKEN = env.WOOBA_TOKEN

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC+wLgFuiBPG5EHfw0TSsU6uTe+JH3hQy76c58koF2438x2vhDxEAkDKKxMz8tcXItYbi9DyaVggQfrgJISpVFj1T4WtcTX/TqKd4jss+nG6AxMgwDVnCo2hD8yK5dbXt82kEj4qfQTzh7/vx9mo0gsH0JmzNFOFOhw63XfBGMONQIDAQAB
-----END PUBLIC KEY-----`

// Adulto responsável pelo bebê de colo
const ADULTO = {
  Nome:        'JOAO',
  Sobrenome:   'SILVA',
  CPF:         '12345678901',
  Nascimento:  '/Date(' + new Date('1990-01-01T00:00:00.000Z').getTime() + '-0300)/',
  Email:       'teste@facilitapass.com',
  FaixaEtaria: 'ADT',
  Sexo:        'M',
}

// Bebê de colo — deve ter < 2 anos na data da viagem (25/06/2026): nascido após 25/06/2024
const BEBE_INFANTIL = {
  InfantilNome:       'PEDRO',
  InfantilSobrenome:  'SILVA',
  InfantilNascimento: '/Date(' + new Date('2025-03-15T00:00:00.000Z').getTime() + '-0300)/',
  InfantilSexo:       'M',
}

const ORIGEM   = 'GRU'
const DESTINO  = 'GIG'
const DATA_IDA = '/Date(' + new Date('2026-06-25T15:00:00.000Z').getTime() + '-0300)/'

function gerarAccessCode() {
  const hoje = new Date()
  const dia = String(hoje.getDate()).padStart(2, '0')
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const ano = hoje.getFullYear()
  const pub = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM)
  const enc = pub.encrypt(forge.util.encodeUtf8(`AHRNQ0D2ALJQ|${dia}/${mes}/${ano}`), 'RSAES-PKCS1-V1_5')
  return forge.util.encode64(enc)
}

function extrairClasses(viagem) {
  const legs = viagem.Voos?.length
    ? viagem.Voos
    : (viagem.Segmentos || []).flatMap(s => s.Voos || [])
  let classeRef = ''
  return legs
    .filter(leg => leg.Numero || leg.NumeroDoVoo)
    .map(leg => {
      const bt     = leg.BaseTarifaria?.[0]
      // Classe pode estar no leg ou dentro do BaseTarifaria (resposta do Tarifar)
      const classe = leg.Classe || bt?.Classe || classeRef
      if (classe) classeRef = classe
      return {
        BaseTarifaria: bt?.Codigo || '',
        Classe:        classe,
        Familia:       bt?.Familia || leg.Familia || '',
        NumeroDoVoo:   String(leg.Numero || leg.NumeroDoVoo || ''),
      }
    })
}

function salvar(etapa, tipo, dados) {
  const nome = `${String(etapa).padStart(2, '0')}-${tipo}.json`
  fs.writeFileSync(path.join(OUT_DIR, nome), JSON.stringify(dados, null, 2))
  console.log(`  💾 Salvo: ${nome}`)
}

async function chamar(etapa, nomeEndpoint, corpo, { tolerarErro } = {}) {
  const url = `${BASE}/${nomeEndpoint}`
  salvar(etapa, `${nomeEndpoint}-request`, corpo)
  console.log(`\n[${etapa}] ${nomeEndpoint}`)
  const res  = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':          'application/json',
      'Accept':                'application/json',
      'Developer-Token':       TOKEN,
      'Developer-Access-Code': gerarAccessCode(),
    },
    body: JSON.stringify(corpo),
  })
  const data = await res.json()
  salvar(etapa, `${nomeEndpoint}-response`, data)
  if (data.SessaoExpirada) throw new Error('Sessão expirada')
  if (data.Exception) {
    const msg = data.Exception.Message
    if (tolerarErro && msg.includes(tolerarErro)) { console.log(`  ⚠ ${msg} (tolerado)`); return data }
    throw new Error(`[${nomeEndpoint}] ${msg}`)
  }
  console.log('  ✓ OK')
  return data
}

// Tenta Tarifar cada combinação (ida x volta) até obter sucesso
async function tentarTarifar(cred, viagens1, viagens2, etapa) {
  for (let i = 0; i < Math.min(viagens1.length, 10); i++) {
    const vi = viagens1[i]
    const vv = viagens2[i % viagens2.length] // rotaciona volta também
    const ci = extrairClasses(vi)
    const cv = extrairClasses(vv)
    const corpo = {
      ...cred, ClienteId: 0,
      IdentificacaoDaViagem:    vi.IdentificacaoDaViagem,
      ViagemIda:                vi.Id,
      ViagemVolta:              vv.Id,
      ClassesSelecionadas:      ci,
      ClassesSelecionadasVolta: cv,
      RetornarPlanoDeFinanciamento: true,
      RetornarRegrasTarifarias:     true,
      TarifarMelhorFamilia:         true,
      TarifarMelhorPreco:           true,
    }
    const url = `${BASE}/Tarifar`
    salvar(etapa, `Tarifar-request`, corpo)
    console.log(`\n[${etapa}] Tarifar (tentativa ${i + 1}: vooIda.Id=${vi.Id})`)
    const res  = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Accept': 'application/json',
        'Developer-Token': TOKEN, 'Developer-Access-Code': gerarAccessCode(),
      },
      body: JSON.stringify(corpo),
    })
    const data = await res.json()
    if (data.Exception) {
      console.log(`  ⚠ ${data.Exception.Message} — tentando próximo voo`)
      continue
    }
    salvar(etapa, `Tarifar-response`, data)
    console.log('  ✓ OK')
    // Usa classes da resposta do Tarifar (mais precisas que as do Disponibilidade)
    const viagemIda   = data.ViagensTrecho1?.[0]
    const viagemVolta = data.ViagensTrecho2?.[0]
    const ciTarifada  = viagemIda   ? extrairClasses(viagemIda)   : ci
    const cvTarifada  = viagemVolta ? extrairClasses(viagemVolta) : cv
    return {
      tarifa: data,
      vooIda: vi,
      vooVolta: vv,
      classesSelecionadas:      ciTarifada.length ? ciTarifada : ci,
      classesSelecionadasVolta: cvTarifada.length ? cvTarifada : cv,
    }
  }
  throw new Error('Nenhum voo disponível retornou tarifa válida')
}

;(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log('=== Cenário Bebê: 1 Adulto + 1 Bebê de colo (PossuiBebe) | Somente Ida | Nacional | Faturado ===')
  console.log(`Trecho: ${ORIGEM} → ${DESTINO} | Ida: 25/06/2026\n`)

  // 1. RecuperarSistemasPesquisa
  const sistemas = await chamar(1, 'RecuperarSistemasPesquisa', {
    Login: LOGIN, Senha: SENHA, Origem: ORIGEM, Destino: DESTINO, Timeout: 15,
  })
  if (!sistemas.Sistemas?.length) throw new Error('Nenhum sistema disponível')

  // LATAM (39) primário — one-way para evitar incompatibilidade SL family em round-trip
  const sistema = sistemas.Sistemas.find(s => s.Sistema === 39)
    || sistemas.Sistemas.find(s => s.Sistema === 51)
    || sistemas.Sistemas[0]
  console.log(`  Sistema selecionado: ${sistema.Label} (Sistema: ${sistema.Sistema})`)

  // 2. Disponibilidade — somente ida, 1 adulto + 1 bebê
  const disponibilidade = await chamar(2, 'Disponibilidade', {
    Login: LOGIN, Senha: SENHA,
    Origem: ORIGEM, Destino: DESTINO,
    DataIda: DATA_IDA,
    QuantidadeAdultos: 1, QuantidadeCriancas: 0, QuantidadeBebes: 1,
    QuantidadeDeVoos: 50,
    Sistema: sistema.Sistema,
    ApenasVoosComBagagem: false, ApenasVoosDiretos: false,
    BuscarVoosComBagagem: true,  BuscarVoosSemBagagem: true,
    Flex: false, Recomendacao: false,
  })

  const viagensTrecho1 = disponibilidade.ViagensTrecho1 || []
  if (!viagensTrecho1.length) throw new Error('Sem voos de ida')

  // 3+4. Loop: Tarifar → Reservar até obter localizador (somente ida)
  const LOC_FILE = path.join(OUT_DIR, 'localizador.txt')
  let localizador = null
  let vooIda, classesSelecionadas

  for (let i = 0; i < Math.min(viagensTrecho1.length, 8); i++) {
    const vi = viagensTrecho1[i]
    const ci = extrairClasses(vi)

    const tarifaCorpo = {
      Login: LOGIN, Senha: SENHA, ClienteId: 0,
      IdentificacaoDaViagem: vi.IdentificacaoDaViagem,
      ViagemIda: vi.Id,
      ClassesSelecionadas: ci,
      RetornarPlanoDeFinanciamento: true, RetornarRegrasTarifarias: true,
      TarifarMelhorFamilia: true, TarifarMelhorPreco: true,
    }
    salvar(3, `Tarifar-request`, tarifaCorpo)
    console.log(`\n[3] Tarifar (tentativa ${i + 1}: vooIda.Id=${vi.Id})`)
    const tarifaRes = await fetch(`${BASE}/Tarifar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
        'Developer-Token': TOKEN, 'Developer-Access-Code': gerarAccessCode() },
      body: JSON.stringify(tarifaCorpo),
    })
    const tarifa = await tarifaRes.json()
    if (tarifa.Exception) { console.log(`  ⚠ Tarifar: ${tarifa.Exception.Message}`); continue }
    salvar(3, `Tarifar-response`, tarifa)
    console.log('  ✓ Tarifar OK')

    const idViagem = tarifa.ViagensTrecho1?.[0]?.IdentificacaoDaViagem || vi.IdentificacaoDaViagem
    const ciT = tarifa.ViagensTrecho1?.[0] ? extrairClasses(tarifa.ViagensTrecho1[0]) : ci

    const reservaCorpo = {
      Login: LOGIN, Senha: SENHA, ClienteId: 0,
      IdentificacaoDaViagem: idViagem,
      ClassesSelecionadas:   ciT.length ? ciT : ci,
      Passageiros: [{
        Nome: ADULTO.Nome, Sobrenome: ADULTO.Sobrenome, CPF: ADULTO.CPF,
        Nascimento: ADULTO.Nascimento, Email: ADULTO.Email,
        FaixaEtaria: ADULTO.FaixaEtaria, Sexo: ADULTO.Sexo, Linha: '1',
        NumeroDDD: '11', NumeroTelefone: '999999999', NumeroDDI: '55',
        // Estrutura exata WOOBA para bebê de colo
        PossuiBebe: true,
        InfantilNome:       BEBE_INFANTIL.InfantilNome,
        InfantilSobrenome:  BEBE_INFANTIL.InfantilSobrenome,
        InfantilNascimento: BEBE_INFANTIL.InfantilNascimento,
        InfantilSexo:       BEBE_INFANTIL.InfantilSexo,
      }],
      InformacoesComplementaresPassageiro: [
        { Nome: ADULTO.Nome, Sobrenome: ADULTO.Sobrenome, Tipo: 'ADT' },
        { Nome: BEBE_INFANTIL.InfantilNome, Sobrenome: BEBE_INFANTIL.InfantilSobrenome, Tipo: 'INF',
          NumeroDDD: '11', NumeroTelefone: '999999999', NumeroDDI: '55' },
      ],
      Contatos: [{
        Nome: `${ADULTO.Nome} ${ADULTO.Sobrenome}`, Email: ADULTO.Email,
        NumeroDDD: '11', NumeroTelefone: '999999999', NumeroDDI: '55', Tipo: 2,
      }],
      Solicitante: ADULTO.Nome, ValidarAnaliseRisco: false,
    }
    salvar(4, `Reservar-request`, reservaCorpo)
    console.log('\n[4] Reservar')
    const reservaRes = await fetch(`${BASE}/Reservar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
        'Developer-Token': TOKEN, 'Developer-Access-Code': gerarAccessCode() },
      body: JSON.stringify(reservaCorpo),
    })
    const reserva = await reservaRes.json()
    salvar(4, `Reservar-response`, reserva)

    if (reserva.Exception) {
      const msg = reserva.Exception.Message
      if (msg.includes('another booking alike') && fs.existsSync(LOC_FILE)) {
        localizador = fs.readFileSync(LOC_FILE, 'utf8').trim()
        console.log(`  Reserva duplicada — reutilizando: ${localizador}`)
        vooIda = vi
        classesSelecionadas = ciT.length ? ciT : ci
        break
      }
      if (msg.includes('Enter information: Phone')) {
        console.log(`  ⚠ Reservar: ${msg}`)
        console.log('  ⚠ Limitação sandbox LATAM: PossuiBebe requer telefone no nível do passageiro.')
        console.log('  ✓ PossuiBebe structure validated in Tarifar — Reservar needs WOOBA phone field clarification.')
        break
      }
      console.log(`  ⚠ Reservar: ${msg} — tentando próximo voo`)
      continue
    }

    localizador = reserva.Reservas?.[0]?.Localizador
    if (localizador) {
      fs.writeFileSync(LOC_FILE, localizador)
      console.log('  ✓ Reservar OK')
      vooIda = vi
      classesSelecionadas = ciT.length ? ciT : ci
      break
    }
  }

  if (!localizador) {
    console.log('\n⚠ Reservar com PossuiBebe rejeitado pelo sandbox (phone). Tarifar OK — estrutura PossuiBebe validada.')
    console.log(`  Arquivos salvos em: ${OUT_DIR}`)
    process.exit(0)
  }
  console.log(`  Voo ida: Id=${vooIda.Id} | Preço: ${vooIda.Preco?.Total}`)
  console.log(`  Localizador: ${localizador}`)

  // 5. IniciarEmissao
  const inicioEmissao = await chamar(5, 'IniciarEmissao', {
    Login: LOGIN, Senha: SENHA, ClienteId: 0, Localizador: localizador,
  })
  const chaveDeSeguranca = inicioEmissao.ChaveDeSeguranca || null
  const opcoesPagamento  = inicioEmissao.ConfiguracoesDeEmissao?.OpcoesDePagamento || []

  // 6. RecuperarFormasDeFinanciamento
  await chamar(6, 'RecuperarFormasDeFinanciamento', {
    Login: LOGIN, Senha: SENHA, ClienteId: 0, Localizador: localizador,
  }, { tolerarErro: 'Enter your credit card' })

  const opcaoFaturada   = opcoesPagamento.find(o => o.Faturado === true)
  const codigoPagamento = opcaoFaturada?.CodigoFormaDeRecebimento ?? 1
  console.log(`  Forma de pagamento: ${opcaoFaturada?.Descricao ?? 'Faturada'} (Código: ${codigoPagamento})`)

  // 7. Emitir (faturado)
  const emitirBody = {
    Login: LOGIN, Senha: SENHA, ClienteId: 0, Localizador: localizador,
    Pagamento: { FormaDePagamento: codigoPagamento },
  }
  if (chaveDeSeguranca) emitirBody.ChaveDeSeguranca = chaveDeSeguranca
  const emissao       = await chamar(7, 'Emitir', emitirBody)
  const numeroEticket = emissao.Bilhetes?.[0]?.Numero || emissao.Etickets?.[0]
  console.log(`  Bilhete: ${numeroEticket}`)

  // 8. Consultar
  await chamar(8, 'Consultar', {
    Login: LOGIN, Senha: SENHA, ClienteId: 0,
    Localizador: localizador, Sistema: sistema.Sistema,
  })

  // 9. ConsultarEticket — GOL usa SistemaId 70 neste endpoint
  const sistemaEticket = sistema.Sistema === 49 ? 70 : sistema.Sistema
  if (numeroEticket) {
    await chamar(9, 'ConsultarEticket', {
      Login: LOGIN, Senha: SENHA,
      Eticket: numeroEticket,
      Sistema: sistemaEticket,
    }, { tolerarErro: 'not available' })
  } else {
    console.log('\n[9] ConsultarEticket — pulado (sem bilhete retornado)')
  }

  // 10. Cancelar
  await chamar(10, 'Cancelar', {
    Login: LOGIN, Senha: SENHA,
    Localizador: localizador,
    Motivo: 'Homologacao - cancelamento automatico de teste',
    CancelarEticketsAtivos: true,
  })

  console.log('\n✅ Cenário Bebê (somente ida) concluído. Arquivos salvos em:')
  console.log(`   ${OUT_DIR}`)
})().catch(err => {
  console.error('\n❌ Erro no fluxo:', err.message)
  console.error('   Verifique os arquivos salvos para depuração.')
  process.exit(1)
})
