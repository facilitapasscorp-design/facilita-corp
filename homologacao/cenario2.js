/**
 * Cenário 2 - Homologação WOOBA
 * 2 Adultos | Ida e volta | Internacional LIS x MAD | CIA IB (Amadeus) | Pagamento faturado
 *
 * Fluxo: RecuperarSistemasPesquisa → Disponibilidade (ida) → Disponibilidade (volta)
 *        → Tarifar → Reservar → IniciarEmissao → RecuperarFormasDeFinanciamento
 *        → Emitir (faturado) → Consultar → ConsultarEticket → Cancelar
 *
 * Nota: Amadeus sandbox retorna ViagensTrecho1 mas não ViagensTrecho2 em busca combinada
 *       para LIS×MAD. Por isso fazemos duas chamadas Disponibilidade separadas.
 */

const fs    = require('fs')
const path  = require('path')
const forge = require('node-forge')

const OUT_DIR = path.join(__dirname, 'cenario2-2adultos-idavolta-internacional-faturado')
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

const ADT1 = { Nome: 'JOAO',  Sobrenome: 'SILVA',  CPF: '12345678901',
  Nascimento: '/Date(631152000000-0300)/', Email: 'teste@facilitapass.com',  FaixaEtaria: 'ADT', Sexo: 'M' }
const ADT2 = { Nome: 'MARIA', Sobrenome: 'SANTOS', CPF: '98765432100',
  Nascimento: '/Date(473385600000-0300)/', Email: 'teste2@facilitapass.com', FaixaEtaria: 'ADT', Sexo: 'F' }

const ORIGEM     = 'LIS'
const DESTINO    = 'MAD'
const DATA_IDA   = '/Date(' + new Date('2026-06-25T15:00:00.000Z').getTime() + '-0300)/'
const DATA_VOLTA = '/Date(' + new Date('2026-07-02T15:00:00.000Z').getTime() + '-0300)/'

function gerarAccessCode() {
  const d = new Date()
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const pub = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM)
  const enc = pub.encrypt(forge.util.encodeUtf8(`AHRNQ0D2ALJQ|${dia}/${mes}/${d.getFullYear()}`), 'RSAES-PKCS1-V1_5')
  return forge.util.encode64(enc)
}

// Extrai ClassesSelecionadas para todos os legs de um voo (inclusive conexões)
function extrairClasses(viagem) {
  const legs = viagem.Voos?.length
    ? viagem.Voos
    : (viagem.Segmentos || []).flatMap(s => s.Voos || [])
  let classeRef = ''
  return legs.filter(l => l.Numero || l.NumeroDoVoo).map(leg => {
    const bt = leg.BaseTarifaria?.[0]
    const classe = leg.Classe || classeRef
    if (classe) classeRef = classe
    return { BaseTarifaria: bt?.Codigo || '', Classe: classe, Familia: bt?.Familia || '',
             NumeroDoVoo: leg.Numero || leg.NumeroDoVoo || '' }
  })
}

function salvar(etapa, tipo, dados) {
  const nome = `${String(etapa).padStart(2, '0')}-${tipo}.json`
  fs.writeFileSync(path.join(OUT_DIR, nome), JSON.stringify(dados, null, 2))
  console.log(`  💾 Salvo: ${nome}`)
}

// apiEndpoint: endpoint real da API (quando difere do label usado no arquivo)
async function chamar(etapa, label, corpo, { tolerarErro, apiEndpoint } = {}) {
  const url = `${BASE}/${apiEndpoint || label}`
  salvar(etapa, `${label}-request`, corpo)
  console.log(`\n[${etapa}] ${label}`)

  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json',
               'Developer-Token': TOKEN, 'Developer-Access-Code': gerarAccessCode() },
    body: JSON.stringify(corpo),
  })
  const data = await res.json()
  salvar(etapa, `${label}-response`, data)

  if (data.SessaoExpirada) throw new Error('Sessão expirada')
  if (data.Exception) {
    const msg = data.Exception.Message
    if (tolerarErro && msg.includes(tolerarErro)) { console.log(`  ⚠ ${msg} (tolerado)`); return data }
    throw new Error(`[${label}] ${msg}`)
  }
  console.log('  ✓ OK')
  return data
}

;(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log('=== Cenário 2: 2 Adultos | Ida e volta | Internacional LIS×MAD | IB/Amadeus | Faturado ===')
  console.log(`Trecho: ${ORIGEM}→${DESTINO} | Ida: 25/06/2026 | Volta: 02/07/2026\n`)

  // 1. RecuperarSistemasPesquisa
  const sistemas = await chamar(1, 'RecuperarSistemasPesquisa', {
    Login: LOGIN, Senha: SENHA, Origem: ORIGEM, Destino: DESTINO, Timeout: 15,
  })
  if (!sistemas.Sistemas?.length) throw new Error('Nenhum sistema disponível')

  // Amadeus (28) para rotas internacionais com IB
  const sistema = sistemas.Sistemas.find(s => s.Sistema === 28)
    || sistemas.Sistemas.find(s => s.Sistema === 18)
    || sistemas.Sistemas[0]
  console.log(`  Sistema selecionado: ${sistema.Label} (Sistema: ${sistema.Sistema})`)

  const dispBase = {
    Login: LOGIN, Senha: SENHA,
    QuantidadeAdultos: 2, QuantidadeCriancas: 0, QuantidadeBebes: 0,
    QuantidadeDeVoos: 10, Sistema: sistema.Sistema,
    ApenasVoosComBagagem: false, ApenasVoosDiretos: false,
    BuscarVoosComBagagem: true,  BuscarVoosSemBagagem: true,
    Flex: false, Recomendacao: false,
  }

  // 2. Disponibilidade — ida (LIS→MAD)
  const dispIda = await chamar(2, 'Disponibilidade-ida',
    { ...dispBase, Origem: ORIGEM, Destino: DESTINO, DataIda: DATA_IDA },
    { apiEndpoint: 'Disponibilidade' })
  const viagensIda = dispIda.ViagensTrecho1 || []
  if (!viagensIda.length) throw new Error('Sem voos de ida LIS→MAD')

  // 3. Disponibilidade — volta (MAD→LIS) — busca separada pois sandbox Amadeus
  //    não retorna ViagensTrecho2 na busca combinada para esta rota
  const dispVolta = await chamar(3, 'Disponibilidade-volta',
    { ...dispBase, Origem: DESTINO, Destino: ORIGEM, DataIda: DATA_VOLTA },
    { apiEndpoint: 'Disponibilidade' })
  const viagensVolta = dispVolta.ViagensTrecho1 || []
  if (!viagensVolta.length) throw new Error('Sem voos de volta MAD→LIS')

  // Prefere voo com conexão — sandbox Amadeus bloqueia voos diretos com companyTP policy
  const vooIda   = viagensIda.find(v => (v.Voos?.length || 0) >= 2 || (v.Segmentos||[]).flatMap(s=>s.Voos||[]).length >= 2) || viagensIda[1] || viagensIda[0]
  const vooVolta = viagensVolta.find(v => (v.Voos?.length || 0) >= 2 || (v.Segmentos||[]).flatMap(s=>s.Voos||[]).length >= 2) || viagensVolta[1] || viagensVolta[0]
  const classesIda   = extrairClasses(vooIda)
  const classesVolta = extrairClasses(vooVolta)

  console.log(`  Voo ida:   Id=${vooIda.Id}   | Preço: ${vooIda.Preco?.Total}   | Legs: ${classesIda.length}`)
  console.log(`  Voo volta: Id=${vooVolta.Id} | Preço: ${vooVolta.Preco?.Total} | Legs: ${classesVolta.length}`)

  // 4. Tarifar (round-trip com IdentificacaoDaViagemVolta da busca separada)
  const tarifa = await chamar(4, 'Tarifar', {
    Login: LOGIN, Senha: SENHA, ClienteId: 0,
    IdentificacaoDaViagem: vooIda.IdentificacaoDaViagem,
    ViagemIda:             vooIda.Id,
    ViagemVolta:           vooVolta.Id,
    ClassesSelecionadas:   classesIda,
    ClassesSelecionadasVolta:   classesVolta,
    RetornarPlanoDeFinanciamento: true, RetornarRegrasTarifarias: true,
    TarifarMelhorFamilia: true,         TarifarMelhorPreco: true,
  })
  const idViagem = tarifa.ViagensTrecho1?.[0]?.IdentificacaoDaViagem || vooIda.IdentificacaoDaViagem

  // 5. Reservar
  const LOC_FILE = path.join(OUT_DIR, 'localizador.txt')
  const reserva  = await chamar(5, 'Reservar', {
    Login: LOGIN, Senha: SENHA, ClienteId: 0,
    IdentificacaoDaViagem:  idViagem,
    ClassesSelecionadas:    classesIda,
    ClassesSelecionadasVolta: classesVolta,
    Passageiros: [
      { Nome: ADT1.Nome, Sobrenome: ADT1.Sobrenome, CPF: ADT1.CPF, Nascimento: ADT1.Nascimento,
        Email: ADT1.Email, FaixaEtaria: ADT1.FaixaEtaria, Sexo: ADT1.Sexo, Linha: '1' },
      { Nome: ADT2.Nome, Sobrenome: ADT2.Sobrenome, CPF: ADT2.CPF, Nascimento: ADT2.Nascimento,
        Email: ADT2.Email, FaixaEtaria: ADT2.FaixaEtaria, Sexo: ADT2.Sexo, Linha: '2' },
    ],
    InformacoesComplementaresPassageiro: [
      { Nome: ADT1.Nome, Sobrenome: ADT1.Sobrenome, Tipo: 'ADT' },
      { Nome: ADT2.Nome, Sobrenome: ADT2.Sobrenome, Tipo: 'ADT' },
    ],
    Contatos: [{ Nome: `${ADT1.Nome} ${ADT1.Sobrenome}`, Email: ADT1.Email,
                 NumeroDDD: '11', NumeroTelefone: '999999999', NumeroDDI: '55', Tipo: 0 }],
    Solicitante: ADT1.Nome, ValidarAnaliseRisco: false,
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

  // 6. IniciarEmissao
  const inicioEmissao = await chamar(6, 'IniciarEmissao', {
    Login: LOGIN, Senha: SENHA, ClienteId: 0, Localizador: localizador,
  })
  const chaveDeSeguranca = inicioEmissao.ChaveDeSeguranca || null
  const opcoesPagamento  = inicioEmissao.ConfiguracoesDeEmissao?.OpcoesDePagamento || []

  // 7. RecuperarFormasDeFinanciamento (tolerado para pagamento faturado)
  await chamar(7, 'RecuperarFormasDeFinanciamento', {
    Login: LOGIN, Senha: SENHA, ClienteId: 0, Localizador: localizador,
  }, { tolerarErro: 'Enter your credit card' })

  const opcaoFaturada   = opcoesPagamento.find(o => o.Faturado === true)
  const codigoPagamento = opcaoFaturada?.CodigoFormaDeRecebimento ?? 1
  console.log(`  Forma de pagamento: ${opcaoFaturada?.Descricao ?? 'Faturada'} (Código: ${codigoPagamento})`)

  // 8. Emitir (faturado)
  const emitirBody = {
    Login: LOGIN, Senha: SENHA, ClienteId: 0, Localizador: localizador,
    Pagamento: { FormaDePagamento: codigoPagamento },
  }
  if (chaveDeSeguranca) emitirBody.ChaveDeSeguranca = chaveDeSeguranca
  const emissao   = await chamar(8, 'Emitir', emitirBody)
  const bilhete   = emissao.Bilhetes?.[0]?.Numero
  console.log(`  Bilhete: ${bilhete}`)

  // 9. Consultar
  await chamar(9, 'Consultar', {
    Login: LOGIN, Senha: SENHA, ClienteId: 0, Localizador: localizador, Sistema: sistema.Sistema,
  })

  // 10. ConsultarEticket (tolera "not available" — Amadeus sandbox não suporta)
  if (bilhete) {
    await chamar(10, 'ConsultarEticket', {
      Login: LOGIN, Senha: SENHA, Eticket: bilhete, Sistema: sistema.Sistema,
    }, { tolerarErro: 'not available' })
  } else {
    console.log('\n[10] ConsultarEticket — pulado (sem bilhete)')
  }

  // 11. Cancelar
  await chamar(11, 'Cancelar', {
    Login: LOGIN, Senha: SENHA,
    Localizador: localizador, Motivo: 'Homologacao - cancelamento automatico de teste',
    CancelarEticketsAtivos: true,
  })

  console.log('\n✅ Cenário 2 concluído. Arquivos salvos em:')
  console.log(`   ${OUT_DIR}`)
})().catch(err => {
  console.error('\n❌ Erro no fluxo:', err.message)
  console.error('   O processo parou nesta etapa. Verifique os arquivos salvos para depuração.')
  process.exit(1)
})
