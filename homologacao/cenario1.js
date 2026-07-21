/**
 * Cenário 1 - Homologação WOOBA
 * 1 Adulto | Só ida | Destino nacional | Pagamento faturado
 *
 * Fluxo: RecuperarSistemasPesquisa → Disponibilidade → Tarifar
 *        → Reservar → IniciarEmissao → RecuperarFormasDeFinanciamento
 *        → Emitir (faturado) → Consultar → ConsultarEticket → Cancelar
 */

const fs   = require('fs')
const path = require('path')
const forge = require('node-forge')

// ---------- Configuração ----------

const OUT_DIR = path.join(__dirname, 'cenario1-adulto-ida-nacional-faturado')
const BASE    = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc'

// Lê .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] })
)

const LOGIN  = env.WOOBA_LOGIN
const SENHA  = env.WOOBA_SENHA
const TOKEN  = env.WOOBA_TOKEN

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC+wLgFuiBPG5EHfw0TSsU6uTe+JH3hQy76c58koF2438x2vhDxEAkDKKxMz8tcXItYbi9DyaVggQfrgJISpVFj1T4WtcTX/TqKd4jss+nG6AxMgwDVnCo2hD8yK5dbXt82kEj4qfQTzh7/vx9mo0gsH0JmzNFOFOhw63XfBGMONQIDAQAB
-----END PUBLIC KEY-----`

// Dados do passageiro de teste (1 adulto)
const PASSAGEIRO = {
  Nome:        'JOAO',
  Sobrenome:   'SILVA',
  CPF:         '12345678901',
  Nascimento:  '/Date(631162800000-0300)/', // 01/01/1990
  Email:       'teste@facilitapass.com',
  FaixaEtaria: 'ADT',
  Sexo:        'M',
}

// Parâmetros de busca
const ORIGEM     = 'SAO'
const DESTINO    = 'RIO'
const DATA_IDA   = '/Date(' + new Date('2026-06-25T15:00:00.000Z').getTime() + '-0300)/'

// ---------- Utilitários ----------

function gerarAccessCode() {
  const hoje = new Date()
  const dia = String(hoje.getDate()).padStart(2, '0')
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const ano = hoje.getFullYear()
  const pub = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM)
  const enc = pub.encrypt(forge.util.encodeUtf8(`AHRNQ0D2ALJQ|${dia}/${mes}/${ano}`), 'RSAES-PKCS1-V1_5')
  return forge.util.encode64(enc)
}

function salvar(etapa, tipo, dados) {
  const nome = `${String(etapa).padStart(2, '0')}-${tipo}.json`
  fs.writeFileSync(path.join(OUT_DIR, nome), JSON.stringify(dados, null, 2))
  console.log(`  💾 Salvo: ${nome}`)
}

async function chamar(etapa, nomeEndpoint, corpo, { tolerarErro } = {}) {
  const accessCode = gerarAccessCode()
  const url = `${BASE}/${nomeEndpoint}`

  const reqPayload = { ...corpo }
  salvar(etapa, `${nomeEndpoint}-request`, reqPayload)

  console.log(`\n[${etapa}] ${nomeEndpoint}`)

  const res  = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      'Developer-Token':       TOKEN,
      'Developer-Access-Code': accessCode,
    },
    body: JSON.stringify(reqPayload),
  })

  const data = await res.json()
  salvar(etapa, `${nomeEndpoint}-response`, data)

  if (data.SessaoExpirada) throw new Error('Sessão expirada')
  if (data.Exception) {
    const msg = data.Exception.Message
    if (tolerarErro && msg.includes(tolerarErro)) {
      console.log(`  ⚠ ${msg} (tolerado)`)
      return data
    }
    throw new Error(`[${nomeEndpoint}] ${msg}`)
  }

  console.log(`  ✓ OK`)
  return data
}

// ---------- Fluxo principal ----------

;(async () => {
  console.log('=== Cenário 1: 1 Adulto | Só ida | Nacional | Faturado ===')
  console.log(`Trecho: ${ORIGEM} → ${DESTINO} | Data: 25/06/2026\n`)

  // 1. RecuperarSistemasPesquisa
  const sistemas = await chamar(1, 'RecuperarSistemasPesquisa', {
    Login: LOGIN, Senha: SENHA,
    Origem: ORIGEM, Destino: DESTINO, Timeout: 15,
  })

  if (!sistemas.Sistemas?.length) throw new Error('Nenhum sistema disponível para o trecho')

  // Prefere GOL GWS (49), depois LATAM (39), senão usa o primeiro disponível
  const sistema = sistemas.Sistemas.find(s => s.Sistema === 49)
    || sistemas.Sistemas.find(s => s.Sistema === 39)
    || sistemas.Sistemas[0]
  console.log(`  Sistema selecionado: ${sistema.Label} (Sistema: ${sistema.Sistema})`)

  // 2. Disponibilidade
  const disponibilidade = await chamar(2, 'Disponibilidade', {
    Login: LOGIN, Senha: SENHA,
    Origem: ORIGEM, Destino: DESTINO,
    DataIda: DATA_IDA,
    QuantidadeAdultos: 1, QuantidadeCriancas: 0, QuantidadeBebes: 0,
    QuantidadeDeVoos: 10,
    Sistema: sistema.Sistema,
    ApenasVoosComBagagem: false, ApenasVoosDiretos: false,
    BuscarVoosComBagagem: true,  BuscarVoosSemBagagem: true,
    Flex: false, Recomendacao: false,
  })

  const viagens = disponibilidade.ViagensTrecho1 || []
  if (!viagens.length) throw new Error('Sem disponibilidade de voos para o trecho/data informados')

  const voo = viagens[0]
  const primeiroVooLeg = voo.Voos?.[0] || voo.Segmentos?.[0]?.Voos?.[0]
  const baseTarifaria = primeiroVooLeg?.BaseTarifaria?.[0]

  const classesSelecionadas = [{
    BaseTarifaria: baseTarifaria?.Codigo   || '',
    Classe:        primeiroVooLeg?.Classe  || '',
    Familia:       baseTarifaria?.Familia  || '',
    NumeroDoVoo:   primeiroVooLeg?.Numero  || primeiroVooLeg?.NumeroDoVoo || '',
  }]

  console.log(`  Voo selecionado: Id=${voo.Id} | Preço total: ${voo.Preco?.Total}`)

  // 3. Tarifar (não enviar campos null — WCF retorna HTTP 400)
  const tarifa = await chamar(3, 'Tarifar', {
    Login: LOGIN, Senha: SENHA,
    ClienteId: 0,
    IdentificacaoDaViagem: voo.IdentificacaoDaViagem,
    ViagemIda:             voo.Id,
    ClassesSelecionadas:   classesSelecionadas,
    RetornarPlanoDeFinanciamento: true,
    RetornarRegrasTarifarias:     true,
    TarifarMelhorFamilia:         true,
    TarifarMelhorPreco:           true,
  })

  // IdentificacaoDaViagem atualizada após Tarifar
  const idViagem = tarifa.ViagensTrecho1?.[0]?.IdentificacaoDaViagem || voo.IdentificacaoDaViagem
  const classesTarifadas = tarifa.ViagensTrecho1?.[0]?.Voos?.[0]
  if (classesTarifadas) {
    classesSelecionadas[0].BaseTarifaria = classesTarifadas.BaseTarifaria?.[0]?.Codigo || classesSelecionadas[0].BaseTarifaria
    classesSelecionadas[0].Familia       = classesTarifadas.BaseTarifaria?.[0]?.Familia || classesSelecionadas[0].Familia
  }

  // 4. Reservar (tolera duplicata — reutiliza localizador já salvo)
  const reserva = await chamar(4, 'Reservar', {
    Login: LOGIN, Senha: SENHA,
    ClienteId: 0,
    IdentificacaoDaViagem: idViagem,
    ClassesSelecionadas:   classesSelecionadas,
    Passageiros: [{
      Nome:        PASSAGEIRO.Nome,
      Sobrenome:   PASSAGEIRO.Sobrenome,
      CPF:         PASSAGEIRO.CPF,
      Nascimento:  PASSAGEIRO.Nascimento,
      Email:       PASSAGEIRO.Email,
      FaixaEtaria: PASSAGEIRO.FaixaEtaria,
      Sexo:        PASSAGEIRO.Sexo,
      Linha:       '1',
    }],
    InformacoesComplementaresPassageiro: [{
      Nome:      PASSAGEIRO.Nome,
      Sobrenome: PASSAGEIRO.Sobrenome,
      Tipo:      'ADT',
    }],
    Contatos: [
      { Nome: `${PASSAGEIRO.Nome} ${PASSAGEIRO.Sobrenome}`, Email: PASSAGEIRO.Email, NumeroDDD: '11', NumeroTelefone: '999999999', NumeroDDI: '55', Tipo: 0 },
    ],
    Solicitante:       PASSAGEIRO.Nome,
    ValidarAnaliseRisco: false,
  }, { tolerarErro: 'another booking alike' })

  const LOC_FILE = path.join(OUT_DIR, 'localizador.txt')
  let localizador = reserva.Reservas?.[0]?.Localizador
  if (localizador) {
    fs.writeFileSync(LOC_FILE, localizador)
  } else if (reserva.Exception?.Message?.includes('another booking alike') && fs.existsSync(LOC_FILE)) {
    localizador = fs.readFileSync(LOC_FILE, 'utf8').trim()
    console.log(`  Reserva duplicada — reutilizando localizador salvo: ${localizador}`)
  }
  if (!localizador) throw new Error('Reserva não retornou Localizador')
  console.log(`  Localizador: ${localizador}`)

  // 5. IniciarEmissao
  const inicioEmissao = await chamar(5, 'IniciarEmissao', {
    Login: LOGIN, Senha: SENHA,
    ClienteId: 0,
    Localizador: localizador,
  })

  // ChaveDeSeguranca só existe se ExigirChaveDeSeguranca=true
  const chaveDeSeguranca = inicioEmissao.ChaveDeSeguranca || null
  console.log(`  ChaveDeSeguranca: ${chaveDeSeguranca}`)

  // Opções de pagamento vêm direto do IniciarEmissao (RecuperarFormasDeFinanciamento é só para cartão)
  const opcoesPagamento = inicioEmissao.ConfiguracoesDeEmissao?.OpcoesDePagamento || []

  // 6. RecuperarFormasDeFinanciamento — tolerado: falha para pagamento faturado
  const formas = await chamar(6, 'RecuperarFormasDeFinanciamento', {
    Login: LOGIN, Senha: SENHA,
    ClienteId: 0,
    Localizador: localizador,
  }, { tolerarErro: 'Enter your credit card' })

  // Usa opção faturada do IniciarEmissao (CodigoFormaDeRecebimento=1, Faturado=true)
  const opcaoFaturada = opcoesPagamento.find(o => o.Faturado === true)
  const codigoPagamento = opcaoFaturada?.CodigoFormaDeRecebimento ?? 1
  console.log(`  Forma de pagamento: ${opcaoFaturada?.Descricao ?? 'Faturada'} (Código: ${codigoPagamento})`)

  // 7. Emitir (faturado)
  const emitirBody = {
    Login: LOGIN, Senha: SENHA,
    ClienteId:   0,
    Localizador: localizador,
    Pagamento: {
      FormaDePagamento: codigoPagamento,
    },
  }
  if (chaveDeSeguranca) emitirBody.ChaveDeSeguranca = chaveDeSeguranca

  const emissao = await chamar(7, 'Emitir', emitirBody)

  const eticket = emissao.Etickets?.[0]
  console.log(`  E-ticket: ${eticket}`)

  // 8. Consultar
  await chamar(8, 'Consultar', {
    Login: LOGIN, Senha: SENHA,
    ClienteId:   0,
    Localizador: localizador,
    Sistema:     sistema.Sistema,
  })

  // 9. ConsultarEticket — GOL usa SistemaId 70 neste endpoint
  const sistemaEticket = sistema.Sistema === 49 ? 70 : sistema.Sistema
  if (eticket) {
    await chamar(9, 'ConsultarEticket', {
      Login: LOGIN, Senha: SENHA,
      Eticket: eticket,
      Sistema: sistemaEticket,
    })
  } else {
    console.log('\n[9] ConsultarEticket — pulado (sem e-ticket retornado)')
  }

  // 10. Cancelar
  await chamar(10, 'Cancelar', {
    Login: LOGIN, Senha: SENHA,
    Localizador:          localizador,
    Motivo:               'Homologacao - cancelamento automatico de teste',
    CancelarEticketsAtivos: true,
  })

  console.log('\n✅ Cenário 1 concluído. Arquivos salvos em:')
  console.log(`   ${OUT_DIR}`)
})().catch(err => {
  console.error('\n❌ Erro no fluxo:', err.message)
  console.error('   O processo parou nesta etapa. Verifique os arquivos salvos para depuração.')
  process.exit(1)
})
