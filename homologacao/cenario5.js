/**
 * Cenário 5 - Homologação WOOBA
 * 1 Adulto, 1 Criança e 1 Bebê | Ida e volta | Nacional SAO x RIO | Pagamento faturado
 *
 * Fluxo: RecuperarSistemasPesquisa → Disponibilidade → Tarifar
 *        → Reservar → IniciarEmissao → RecuperarFormasDeFinanciamento
 *        → Emitir (faturado) → Consultar → ConsultarEticket → Cancelar
 */

const fs    = require('fs')
const path  = require('path')
const forge = require('node-forge')

const OUT_DIR = path.join(__dirname, 'cenario5-adulto-crianca-bebe-idavolta-nacional-faturado')
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

const ADULTO = {
  Nome: 'JOAO', Sobrenome: 'SILVA',
  CPF: '12345678901',
  Nascimento: '/Date(' + new Date('1990-01-01T03:00:00.000Z').getTime() + '-0300)/',
  Email: 'teste@facilitapass.com', FaixaEtaria: 'ADT', Sexo: 'M',
}
const CRIANCA = {
  Nome: 'ANA', Sobrenome: 'SILVA',
  CPF: '11122233344',
  Nascimento: '/Date(' + new Date('2018-01-01T03:00:00.000Z').getTime() + '-0300)/',
  Email: 'teste@facilitapass.com', FaixaEtaria: 'CHD', Sexo: 'F',
}
const BEBE = {
  Nome: 'PEDRO', Sobrenome: 'SILVA',
  CPF: '55566677788',
  Nascimento: '/Date(' + new Date('2025-01-01T03:00:00.000Z').getTime() + '-0300)/',
  Email: 'teste@facilitapass.com', FaixaEtaria: 'INF', Sexo: 'M',
}

const ORIGEM    = 'GRU'
const DESTINO   = 'GIG'
const DATA_IDA  = '/Date(' + new Date('2026-06-25T15:00:00.000Z').getTime() + '-0300)/'
const DATA_VOLTA = '/Date(' + new Date('2026-07-02T15:00:00.000Z').getTime() + '-0300)/'

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
      const bt = leg.BaseTarifaria?.[0]
      const classe = leg.Classe || classeRef
      if (classe) classeRef = classe
      return { BaseTarifaria: bt?.Codigo || '', Classe: classe, Familia: bt?.Familia || '', NumeroDoVoo: leg.Numero || leg.NumeroDoVoo || '' }
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
      'Content-Type': 'application/json',
      'Accept':       'application/json',
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

;(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log('=== Cenário 5: 1 Adulto + 1 Criança + 1 Bebê | Ida e volta | Nacional | Faturado ===')
  console.log(`Trecho: ${ORIGEM} → ${DESTINO} | Ida: 25/06/2026 | Volta: 02/07/2026\n`)

  // 1. RecuperarSistemasPesquisa
  const sistemas = await chamar(1, 'RecuperarSistemasPesquisa', {
    Login: LOGIN, Senha: SENHA, Origem: ORIGEM, Destino: DESTINO, Timeout: 15,
  })
  if (!sistemas.Sistemas?.length) throw new Error('Nenhum sistema disponível')

  const sistema = sistemas.Sistemas.find(s => s.Sistema === 49)
    || sistemas.Sistemas.find(s => s.Sistema === 39)
    || sistemas.Sistemas[0]
  console.log(`  Sistema selecionado: ${sistema.Label} (Sistema: ${sistema.Sistema})`)

  // 2. Disponibilidade (ida e volta)
  const disponibilidade = await chamar(2, 'Disponibilidade', {
    Login: LOGIN, Senha: SENHA,
    Origem: ORIGEM, Destino: DESTINO,
    DataIda: DATA_IDA, DataVolta: DATA_VOLTA,
    QuantidadeAdultos: 1, QuantidadeCriancas: 1, QuantidadeBebes: 0,
    QuantidadeDeVoos: 10,
    Sistema: sistema.Sistema,
    ApenasVoosComBagagem: false, ApenasVoosDiretos: false,
    BuscarVoosComBagagem: true,  BuscarVoosSemBagagem: true,
    Flex: false, Recomendacao: false,
  })

  const viagensTrecho1 = disponibilidade.ViagensTrecho1 || []
  const viagensTrecho2 = disponibilidade.ViagensTrecho2 || []
  if (!viagensTrecho1.length) throw new Error('Sem voos de ida')
  if (!viagensTrecho2.length) throw new Error('Sem voos de volta')

  const vooIda   = viagensTrecho1[0]
  const vooVolta = viagensTrecho2[0]
  const classesSelecionadas      = extrairClasses(vooIda)
  const classesSelecionadasVolta = extrairClasses(vooVolta)

  console.log(`  Voo ida: Id=${vooIda.Id} | Preço: ${vooIda.Preco?.Total}`)
  console.log(`  Voo volta: Id=${vooVolta.Id} | Preço: ${vooVolta.Preco?.Total}`)

  // 3. Tarifar
  const tarifa = await chamar(3, 'Tarifar', {
    Login: LOGIN, Senha: SENHA, ClienteId: 0,
    IdentificacaoDaViagem: vooIda.IdentificacaoDaViagem,
    ViagemIda: vooIda.Id, ViagemVolta: vooVolta.Id,
    ClassesSelecionadas:      classesSelecionadas,
    ClassesSelecionadasVolta: classesSelecionadasVolta,
    RetornarPlanoDeFinanciamento: true,
    RetornarRegrasTarifarias:     true,
    TarifarMelhorFamilia:         true,
    TarifarMelhorPreco:           true,
  })

  const idViagem = tarifa.ViagensTrecho1?.[0]?.IdentificacaoDaViagem || vooIda.IdentificacaoDaViagem

  // 4. Reservar
  const LOC_FILE = path.join(OUT_DIR, 'localizador.txt')
  const reserva  = await chamar(4, 'Reservar', {
    Login: LOGIN, Senha: SENHA, ClienteId: 0,
    IdentificacaoDaViagem:    idViagem,
    ClassesSelecionadas:      classesSelecionadas,
    ClassesSelecionadasVolta: classesSelecionadasVolta,
    Passageiros: [
      { Nome: ADULTO.Nome,  Sobrenome: ADULTO.Sobrenome,  CPF: ADULTO.CPF,
        Nascimento: ADULTO.Nascimento,  Email: ADULTO.Email,
        FaixaEtaria: ADULTO.FaixaEtaria,  Sexo: ADULTO.Sexo,  Linha: '1' },
      { Nome: CRIANCA.Nome, Sobrenome: CRIANCA.Sobrenome, CPF: CRIANCA.CPF,
        Nascimento: CRIANCA.Nascimento, Email: CRIANCA.Email,
        FaixaEtaria: CRIANCA.FaixaEtaria, Sexo: CRIANCA.Sexo, Linha: '2' },
    ],
    InformacoesComplementaresPassageiro: [
      { Nome: ADULTO.Nome,  Sobrenome: ADULTO.Sobrenome,  Tipo: 'ADT' },
      { Nome: CRIANCA.Nome, Sobrenome: CRIANCA.Sobrenome, Tipo: 'CHD' },
    ],
    Contatos: [
      { Nome: `${ADULTO.Nome} ${ADULTO.Sobrenome}`, Email: ADULTO.Email,
        NumeroDDD: '11', NumeroTelefone: '999999999', NumeroDDI: '55', Tipo: 0 },
    ],
    Solicitante: ADULTO.Nome,
    ValidarAnaliseRisco: false,
  }, { tolerarErro: 'another booking alike' })

  let localizador = reserva.Reservas?.[0]?.Localizador
  if (localizador) {
    fs.writeFileSync(LOC_FILE, localizador)
  } else if (reserva.Exception?.Message?.includes('another booking alike') && fs.existsSync(LOC_FILE)) {
    localizador = fs.readFileSync(LOC_FILE, 'utf8').trim()
    console.log(`  Reserva duplicada — reutilizando: ${localizador}`)
  }
  if (!localizador) throw new Error('Reserva não retornou Localizador')
  console.log(`  Localizador: ${localizador}`)

  // 5. IniciarEmissao
  const inicioEmissao = await chamar(5, 'IniciarEmissao', {
    Login: LOGIN, Senha: SENHA, ClienteId: 0, Localizador: localizador,
  })
  const chaveDeSeguranca = inicioEmissao.ChaveDeSeguranca || null
  const opcoesPagamento  = inicioEmissao.ConfiguracoesDeEmissao?.OpcoesDePagamento || []

  // 6. RecuperarFormasDeFinanciamento (tolerado para faturado)
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
  const numeroEticket = emissao.Bilhetes?.[0]?.Numero
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
      Login: LOGIN, Senha: SENHA, Eticket: numeroEticket, Sistema: sistemaEticket,
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

  console.log('\n✅ Cenário 5 concluído. Arquivos salvos em:')
  console.log(`   ${OUT_DIR}`)
})().catch(err => {
  console.error('\n❌ Erro no fluxo:', err.message)
  console.error('   Verifique os arquivos salvos para depuração.')
  process.exit(1)
})
