const forge = require('node-forge')

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC+wLgFuiBPG5EHfw0TSsU6uTe+JH3hQy76c58koF2438x2vhDxEAkDKKxMz8tcXItYbi9DyaVggQfrgJISpVFj1T4WtcTX/TqKd4jss+nG6AxMgwDVnCo2hD8yK5dbXt82kEj4qfQTzh7/vx9mo0gsH0JmzNFOFOhw63XfBGMONQIDAQAB
-----END PUBLIC KEY-----`

const DEVELOPER_TOKEN = '6faeb539-37f5-469d-bbad-b42400f56450'
const SENHA = '@Woob@FacilitaPass@2026'
const URL = 'https://wooba-sandbox-api.travellink.com.br/wcfTravellinkJson/AereoNoSession.svc/RecuperarSistemasPesquisa'

function encrypt(valor) {
  const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM)
  const encrypted = publicKey.encrypt(forge.util.encodeUtf8(valor), 'RSAES-PKCS1-V1_5')
  return forge.util.encode64(encrypted)
}

const hoje = new Date()
const dia = String(hoje.getDate()).padStart(2, '0')
const mes = String(hoje.getMonth() + 1).padStart(2, '0')
const ano = hoje.getFullYear()
const data = `${dia}/${mes}/${ano}`

const base64Normal = encrypt(`${SENHA}|${data}`)
const base64UrlSafe = base64Normal.replace(/\+/g, '-').replace(/\//g, '_')
const soSenha = encrypt(SENHA)

const variacoes = [
  { nome: '1) base64 normal (senha|data)', accessCode: base64Normal },
  { nome: '2) URL-safe base64 (senha|data)', accessCode: base64UrlSafe },
  { nome: '3) só a senha (sem pipe e data)', accessCode: soSenha },
]

async function testar({ nome, accessCode }) {
  console.log(`\nTestando: ${nome}`)
  console.log(`Access code: ${accessCode.substring(0, 40)}...`)
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Developer-Token': DEVELOPER_TOKEN,
      },
      body: JSON.stringify({ AccessCode: accessCode }),
    })
    const text = await res.text()
    console.log(`Status HTTP: ${res.status}`)
    console.log(`Resposta: ${text.substring(0, 300)}`)
  } catch (err) {
    console.log(`Erro: ${err.message}`)
  }
}

;(async () => {
  for (const v of variacoes) {
    await testar(v)
  }
})()
