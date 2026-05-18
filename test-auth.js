const forge = require('node-forge')

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC+wLgFuiBPG5EHfw0TSsU6uTe+JH3hQy76c58koF2438x2vhDxEAkDKKxMz8tcXItYbi9DyaVggQfrgJISpVFj1T4WtcTX/TqKd4jss+nG6AxMgwDVnCo2hD8yK5dbXt82kEj4qfQTzh7/vx9mo0gsH0JmzNFOFOhw63XfBGMONQIDAQAB
-----END PUBLIC KEY-----`

const senha = '@Woob@FacilitaPass@2026'

const hoje = new Date()
const dia = String(hoje.getDate()).padStart(2, '0')
const mes = String(hoje.getMonth() + 1).padStart(2, '0')
const ano = hoje.getFullYear()
const data = `${dia}/${mes}/${ano}`
const valor = `${senha}|${data}`

console.log('Valor a criptografar:', valor)

const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM)
const encrypted = publicKey.encrypt(forge.util.encodeUtf8(valor), 'RSAES-PKCS1-V1_5')
const accessCode = forge.util.encode64(encrypted)

console.log('Access code (base64):')
console.log(accessCode)
console.log('\nComprimento do access code:', accessCode.length, 'caracteres')
