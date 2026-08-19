# Manual do sistema Facilita Pass Corp

Este documento existe para uma situação específica: você perdeu o computador,
esqueceu onde estava alguma coisa, ou precisa explicar o sistema para outra
pessoa. Ele diz **onde está cada coisa e para que serve**.

Atualizado em agosto de 2026.

> **Nenhuma senha está escrita aqui, de propósito.** Um documento com senhas
> dentro é um problema esperando acontecer. O que está aqui é onde encontrar
> cada coisa. As senhas em si devem viver num gerenciador de senhas.

---

## 1. Em uma frase

O sistema é um site (`corp.facilitapass.com.br`) que roda no **Railway**, com o
código guardado no **GitHub**, os dados no **Supabase**, e as passagens
compradas através da **WOOBA**, que é a consolidadora.

Se qualquer uma dessas quatro cair, o sistema para. São os quatro pilares.

---

## 2. Onde está cada coisa

### O código

| Onde | O quê |
|---|---|
| `github.com/facilitapasscorp-design/facilita-corp` | O código, versionado. É a fonte da verdade. |
| `~/Desktop/facilita-corp` (no Mac) | A cópia de trabalho, onde as alterações são feitas. |
| Branch `main` | A única que existe. O que está nela é o que vai para o ar. |

**Se o Mac morrer amanhã, nada se perde**, desde que o último trabalho tenha
sido enviado com `git push`. Para recuperar em outro computador:

```
git clone https://github.com/facilitapasscorp-design/facilita-corp.git
cd facilita-corp
npm install
```

Falta só recriar o arquivo `.env.local` (ver seção 4), que **não vai** para o
GitHub de propósito, porque tem as senhas dentro.

### As contas

| Serviço | Para que serve | O que acontece se perder o acesso |
|---|---|---|
| **GitHub** | Guarda o código | Grave. Sem ele não dá para publicar alteração nova. |
| **Railway** | Mantém o site no ar | Grave. O site sai do ar quando algo reiniciar. |
| **Supabase** | Banco de dados e login dos usuários | Gravíssimo. É onde estão empresas, usuários, reservas e passageiros. |
| **WOOBA** | Consolidadora: é ela que reserva e emite | Grave. Sem ela não se compra passagem. |
| **Registro do domínio** | `facilitapass.com.br` | Grave. Perde site e e-mail juntos. |
| **E-mail corp@facilitapass.com.br** | Recuperação de senha de quase tudo | O mais crítico de todos. Ver aviso abaixo. |
| **Instagram @facilitapass.corp** | Vitrine | Recuperável, não urgente. |

> **O e-mail é a chave mestra.** Quem tem acesso ao `corp@facilitapass.com.br`
> consegue redefinir a senha do GitHub, do Railway e do Supabase. Ele merece
> senha forte, verificação em duas etapas e um telefone de recuperação
> atualizado. Se você fizer só uma coisa de segurança este mês, faça essa.

### PARA PREENCHER

Estas informações só você tem. Preencha e guarde:

- Onde o domínio `facilitapass.com.br` está registrado: ______________
- Qual plano do Supabase (gratuito ou pago): ______________
- Qual e-mail foi usado para criar a conta do Railway: ______________
- Qual e-mail foi usado para criar a conta do Supabase: ______________
- Quem é o contato na WOOBA (nome e telefone): ______________

---

## 3. O que cada parte do sistema faz

### As páginas que o cliente vê

| Endereço | O que é |
|---|---|
| `/` | Site institucional. Quem nunca ouviu falar da Facilita Pass cai aqui. |
| `/entrar` | Tela de login. |
| `/recuperar-senha` e `/nova-senha` | Fluxo de esqueci minha senha. |
| `/busca` | O coração: pesquisa de voos, dados do passageiro, reserva, pagamento e emissão. |
| `/painel` | As reservas do usuário. Onde ele vê o que comprou e abre chamado. |
| `/relatorio` | Relatório de gastos. Só quem é admin da empresa cliente enxerga. |
| `/admin` | Seu painel. Empresas, usuários, reservas, políticas, chamados, contatos e passageiros. Só o `corp@facilitapass.com.br` entra. |
| `/privacidade` e `/termos` | Páginas legais. |

### Os bastidores (pasta `app/api`)

São os pedaços que conversam com a WOOBA. O cliente nunca vê, mas se um deles
quebrar, o sistema para de vender.

| Rota | O que faz |
|---|---|
| `buscar-voos` | Pesquisa os voos disponíveis. |
| `tarifar-reservar` | Confirma o preço e gera a reserva (o localizador). |
| `iniciar-emissao` e `iniciar-emitir` | Pagamento e emissão do bilhete. |
| `consultar-reserva` | Busca uma reserva já feita na WOOBA. |
| `cancelar-reserva` | Cancela. |
| `cancelar-expiradas` | Marca como expiradas as reservas que passaram do prazo. |
| `reenviar-comprovante` | Reenvia o comprovante de emissão. |
| `chamados` | Registra a solicitação de alteração ou cancelamento. |
| `empresa/criar-consultivo` e `admin/criar-usuario` | Criação de usuários. |

### As peças reaproveitadas (pasta `lib`)

| Arquivo | O que faz |
|---|---|
| `supabase.ts` | Conexão com o banco. |
| `auth-api.ts` | Confere se quem chamou a rota está logado e pode fazer aquilo. |
| `wooba-auth.ts` | Login na WOOBA. |
| `erros-wooba.ts` | Traduz o erro técnico da WOOBA para português de gente. |
| `api-fetch.ts` | Envia o token de login junto com cada chamada. |
| `aeroportos.ts` | Lista de aeroportos. |
| `atendimento.ts` | O número do WhatsApp do atendimento. Mudou o número? É aqui. |

### O porteiro

O arquivo `proxy.ts` na raiz é quem impede que alguém abra `/busca` ou
`/admin` sem estar logado. Se estiver quebrado, as páginas ficam expostas.

---

## 4. As senhas do sistema (variáveis de ambiente)

O sistema precisa de nove senhas para funcionar. Elas ficam em **dois lugares
ao mesmo tempo**, e os dois precisam estar iguais:

1. No arquivo `.env.local`, dentro da pasta do projeto no Mac (para testar na
   sua máquina). Esse arquivo **nunca** vai para o GitHub.
2. No Railway, em Variables (para o site no ar).

| Nome da variável | De onde vem |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase, em Project Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase, mesma tela |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase, mesma tela. **É a chave de acesso total ao banco. Nunca compartilhe.** |
| `WOOBA_LOGIN` / `WOOBA_SENHA` / `WOOBA_TOKEN` | WOOBA, ambiente de teste |
| `WOOBA_URL_PRODUCAO` / `WOOBA_LOGIN_PRODUCAO` / `WOOBA_SENHA_PRODUCAO` | WOOBA, ambiente real |

**Se o site parar de funcionar do nada e ninguém mexeu no código**, uma
variável faltando no Railway é a primeira suspeita.

Guarde uma cópia dessas nove no gerenciador de senhas. Se você perder o Mac e
elas não estiverem em outro lugar, é preciso pedir tudo de novo para Supabase e
WOOBA.

---

## 5. O banco de dados

Tudo mora no Supabase. As tabelas principais:

| Tabela | O que guarda |
|---|---|
| `empresas` | As empresas clientes |
| `usuarios_empresas` | Quem pertence a qual empresa, e se é admin ou comum |
| `reservas` | Toda reserva feita, com localizador, valor e status |
| `politicas_viagem` | A regra de compra de cada empresa |
| `chamados` | Pedidos de alteração e cancelamento |
| `leads` | Contatos que preencheram o formulário do site |
| `passageiros` | Base de passageiros salvos, por empresa |

Os arquivos `supabase-*.sql` na raiz do projeto são o histórico de como cada
tabela foi criada. **Se um dia precisar montar tudo do zero**, rode-os na
ordem: `reservas`, `admin`, `politicas`, `chamados`, e depois os demais.

### Regra de ouro do banco

Cada tabela tem regras de segurança (chamadas RLS) que garantem que uma empresa
não veja os dados de outra. Isso é aplicado **no banco**, não na tela. Se
alguém desligar isso no Supabase para "resolver um problema", os dados de todos
os clientes ficam expostos entre si. Nunca desligue.

---

## 6. Como publicar uma alteração

No Terminal, dentro de `~/Desktop/facilita-corp`:

```
npm run build     # confere se está tudo certo, demora 1 a 2 minutos
git push          # envia para o GitHub
```

O Railway percebe o envio sozinho e publica em um a três minutos. Dá para
acompanhar em Deployments.

**Se o deploy falhar em "Snapshot code" com "Failed to connect"**, não é o seu
código: é o Railway que não conseguiu baixar do GitHub. Clique nos três
pontinhos e escolha Redeploy.

---

## 7. Quando alguma coisa der errado

| Sintoma | Onde olhar primeiro |
|---|---|
| Site fora do ar | Railway > Deployments. O último está verde? |
| Site no ar mas dando erro | Railway > Logs. Procure por `[RESERVAR]`, `[EMITIR]`, `[CHAMADOS]` |
| Ninguém consegue entrar | Supabase > está pausado por inatividade ou cobrança? |
| Busca não retorna voo nenhum | Provavelmente a WOOBA. Teste o sistema da consolidadora direto. |
| Reserva feita mas não aparece no painel | Railway > Logs, procure `FALHA AO GRAVAR NO BANCO` |
| Cliente não recebe e-mail de senha | Conhecido: o e-mail sai pelo servidor gratuito do Supabase e pode cair no spam. Contorno: trocar a senha pelo admin e mandar no WhatsApp. |

---

## 8. O que ainda está pendente

Anotado para não se perder com o tempo:

- **Resend não configurado.** Sem ele: nenhum e-mail automático sai (aviso de
  chamado, senha de usuário novo). A recuperação de senha funciona pelo
  Supabase, com limite baixo.
- **Sem monitoramento de erro.** Você só descobre um problema quando o cliente
  avisa, ou olhando os Logs do Railway.
- **Backup do banco** depende do plano do Supabase. Confirmar qual é.
- **Dados de cartão passam pelo servidor** a caminho da WOOBA. Não são
  gravados, mas passam. É o maior risco técnico do sistema e cresce a cada
  cliente novo.
- **Relatório antigo conta um passageiro por reserva.** Reservas feitas antes
  de agosto de 2026 não guardaram a lista completa.

---

## 9. Se você precisar entregar isso para outra pessoa

Um desenvolvedor consegue assumir o projeto com: acesso ao GitHub, ao Railway,
ao Supabase, e as nove variáveis de ambiente. O resto ele descobre lendo o
código, que está comentado em português e tem o histórico de commits
explicando o motivo de cada mudança.

Os arquivos `CLAUDE.md` e `AGENTS.md` na raiz do projeto contêm as instruções
de contexto para quem for trabalhar com assistente de IA no projeto.
