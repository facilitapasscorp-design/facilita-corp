import forge from 'node-forge'

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC+wLgFuiBPG5EHfw0TSsU6uTe+JH3hQy76c58koF2438x2vhDxEAkDKKxMz8tcXItYbi9DyaVggQfrgJISpVFj1T4WtcTX/TqKd4jss+nG6AxMgwDVnCo2hD8yK5dbXt82kEj4qfQTzh7/vx9mo0gsH0JmzNFOFOhw63XfBGMONQIDAQAB
-----END PUBLIC KEY-----`

export function gerarAccessCode(): string {
  const hoje = new Date()
  const dia = String(hoje.getDate()).padStart(2, '0')
  const mes = String(hoje.getMonth() + 1).padStart(2, '0')
  const ano = hoje.getFullYear()
  const valor = `AHRNQ0D2ALJQ|${dia}/${mes}/${ano}`

  const publicKey = forge.pki.publicKeyFromPem(PUBLIC_KEY_PEM)
  const encrypted = publicKey.encrypt(forge.util.encodeUtf8(valor), 'RSAES-PKCS1-V1_5')
  return forge.util.encode64(encrypted)
}
