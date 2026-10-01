# Residência, Trilha Foundation

Repositório evolutivo da Trilha Foundation da Residência DevOps na Nuvem. O
mesmo projeto acompanha o aluno durante as 12 sprints e recebe novas capacidades
sem descartar o que já foi construído.

## Estrutura do repositório

```text
residencia-trilha-foundation/
├── site/                              # SPA React e TypeScript
├── backend/
│   └── lambdas/
│       ├── 01-catalog-backend-api-lambda/
│       ├── 02-order-backend-api-lambda/
│       └── 03-order-processor-lambda/
└── infrastructure/
    ├── bootstrap.sh                   # aplica um profile
    ├── foundation/terraform-state/    # reservado para o remote state
    ├── profiles/                      # ponto inicial de cada sprint
    └── stacks/                        # root stacks Terraform evolutivas
        ├── 01-web-edge/
        ├── 02-identity/
        ├── 03-marketplace-api/
        ├── 04-database/
        ├── 05-container-platform/
        └── 06-gitops/
```

Os diretórios em `infrastructure/stacks` serão root stacks independentes, no
mesmo padrão da Trilha Professional. Eles ainda não possuem arquivos `.tf`.

## Como as sprints, as stacks e o state se relacionam

Não existe uma cópia da infraestrutura para cada sprint. Cada diretório em
`infrastructure/stacks` representa uma responsabilidade e evolui no mesmo lugar
ao longo da trilha. Por exemplo, `01-web-edge` continuará sendo a stack de S3,
CloudFront, ACM e Route 53 quando novas capacidades forem adicionadas.

Existem três conceitos diferentes:

- a tag do Git determina a versão do código disponível naquele ponto da trilha;
- o profile determina quais stacks formam o ambiente inicial de uma sprint;
- o state continua independente por stack e acompanha a evolução do ambiente.

O início de cada sprint será marcado por uma tag. Assim, uma pessoa que entrar
diretamente na Sprint 6 poderá usar `start-sprint-06`. Essa versão já conterá o
resultado esperado até a Sprint 5, sem exigir a execução dos laboratórios
anteriores. Quem quiser executar a Sprint 5 poderá usar `start-sprint-05`, que
conterá o ponto anterior à implementação daquele desafio.

```text
start-sprint-05  -> ponto inicial para implementar a infraestrutura do frontend
start-sprint-06  -> frontend da Sprint 5 pronto; início do próximo desafio
```

A `main` representa o ponto mais recente já liberado. As tags preservam os
pontos anteriores sem duplicar diretórios ou manter uma branch por sprint.

### Evolução normal do ambiente

No avanço entre sprints, as mesmas stacks e os mesmos states são utilizados. O
Terraform compara a nova versão do código com a infraestrutura existente e faz
somente as alterações necessárias. As chaves seguirão este padrão:

```text
residencia-foundation/01-web-edge.tfstate
residencia-foundation/02-identity.tfstate
residencia-foundation/03-marketplace-api.tfstate
```

Os profiles `ready-for-sprint-01` até `ready-for-sprint-12`, mais o
`complete`, reproduzem o ambiente ao final da sprint anterior. Um profile
seleciona stacks; ele não cria outra versão da stack nem outro state.

As cinco primeiras sprints são feitas pelo Console da AWS, então os profiles
`ready-for-sprint-01` até `ready-for-sprint-05` não selecionam nenhuma stack.

### Voltar para uma sprint anterior

Fazer apenas o checkout de uma tag antiga não altera a conta AWS. Aplicar código
antigo contra um ambiente mais novo pode remover recursos ou deixar stacks de
sprints posteriores ainda provisionadas.

Para voltar de verdade, existe um ambiente ativo por vez. Primeiro, destrua o
ambiente usando a versão e o profile atuais. Depois, faça checkout da tag
desejada e aplique o profile correspondente:

```bash
./infrastructure/bootstrap.sh destroy ready-for-sprint-06
git checkout start-sprint-05
./infrastructure/bootstrap.sh apply ready-for-sprint-05
```

Manter duas sprints provisionadas simultaneamente exigiria states e nomes de
recursos isolados. Esse cenário não faz parte do fluxo padrão, para manter a
experiência do aluno simples.

## Sprint 1: criar seu fork

No GitHub, abra o repositório original e selecione **Fork**. Depois clone o seu
fork, substituindo `SEU-USUARIO` pelo seu usuário do GitHub:

```bash
git clone https://github.com/SEU-USUARIO/residencia-trilha-foundation.git
cd residencia-trilha-foundation
git remote add upstream https://github.com/kenerry-serain/residencia-trilha-foundation.git
```

O remote `origin` aponta para o seu fork. O remote `upstream` aponta para o
repositório da Residência e será usado para receber as próximas sprints.

## Sprint 2 em diante: atualizar seu fork

Antes de começar uma nova sprint, entre no repositório local e traga a versão
mais recente da Residência:

```bash
cd residencia-trilha-foundation
git checkout main
git pull upstream main
git push origin main
```

O `pull` atualiza seu clone local com o conteúdo liberado no repositório
original. O `push` leva essa atualização para o seu fork no GitHub.

## Executar o site localmente

```bash
npm --prefix site install
npm --prefix site run dev
```

O endereço local padrão é `http://localhost:5173`.

## Autenticação

No desenvolvimento local, o site usa autenticação e dados mock:

```env
VITE_APP_MODE=mock
```

O formulário aceita qualquer e-mail válido e uma senha com pelo menos seis
caracteres. O modo local permite validar cadastro de produto, compra, estoque e
pedidos sem criar recursos na AWS. Nesse modo, sessão, produtos e pedidos ficam
no `localStorage` daquele navegador. Um selo visível identifica o ambiente como
`Mock mode · dados locais`.

Na Sprint 2, o frontend já está preparado para cadastro, confirmação de e-mail,
login, primeiro acesso, recuperação de senha e restauração da sessão pelo
Amazon Cognito. Informe:

```env
VITE_APP_MODE=production
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com
```

O arquivo [`site/.env.sprint-02.example`](site/.env.sprint-02.example) já contém
esse modelo. Copie-o para `site/.env.production.local`, preencha os valores dos
recursos criados no laboratório e gere um novo build.

Depois da autenticação, todas as chamadas ao API Gateway enviam o access token
JWT no cabeçalho `Authorization: Bearer <token>`.

Com `VITE_APP_MODE=production`, o frontend não usa os dados locais. O selo muda
para `Production · AWS` e as operações passam a usar Cognito e API Gateway.

O carrinho permanece no navegador, separado por usuário, até a conclusão da
compra. Produtos, estoque e pedidos usam a API. Cada produto aceita até oito
imagens; o DynamoDB guarda a lista de chaves e os arquivos permanecem no S3.

## Backend da Sprint 2

O código das três Lambdas e a SPA do marketplace já estão prontos. O trabalho
do aluno é empacotar, publicar e conectar os recursos pelo Console da AWS.

| Lambda | Runtime | Responsabilidade |
| --- | --- | --- |
| `catalog-backend-api-lambda` | TypeScript (Node.js 22) | Consultar e cadastrar produtos no DynamoDB e gerar URLs temporárias para imagens no S3 |
| `order-backend-api-lambda` | .NET 8 | Consultar compras e vendas e publicar novas compras na SQS |
| `order-processor-lambda` | TypeScript (Node.js 22) | Consumir a SQS e atualizar estoque e pedido numa transação do DynamoDB |

Na Sprint 2, as Lambdas usam `DATA_SOURCE=dynamodb`. A tabela substitui o mock
em memória e torna o fluxo consistente entre Lambdas e cold starts. Os adapters
para RDS continuam separados e poderão ser ativados depois com
`DATA_SOURCE=rds` e as variáveis de conexão, sem alterar os handlers.

Consulte [backend/README.md](backend/README.md) para conhecer os packages, os
handlers e as variáveis de ambiente.

## Build de produção do site

```bash
npm --prefix site run build
```

Os arquivos estáticos serão gerados em `site/dist` e poderão ser enviados para
o bucket S3 da Sprint 1.
