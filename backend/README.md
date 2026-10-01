# Backend do marketplace, Sprint 2

O backend entrega o fluxo completo de catálogo e pedidos sem antecipar o RDS.
Na Sprint 2, o estado fica em uma tabela do Amazon DynamoDB e as imagens ficam
em um bucket S3. A troca futura para PostgreSQL acontece pelos adapters de
repositório, sem mudar os handlers HTTP.

## Fluxo

```text
React SPA
  -> Cognito: cadastro, confirmação e login
  -> API Gateway HTTP API + JWT authorizer
      -> catalog-backend-api-lambda
          -> DynamoDB: produtos
          -> S3: URL pré-assinada da imagem
      -> order-backend-api-lambda
          -> DynamoDB: consulta produto e pedidos
          -> SQS: publica OrderCreated
              -> order-processor-lambda
                  -> DynamoDB TransactWrite: baixa estoque + grava pedido
```

Uma conta autenticada pode comprar e vender. O `sub` do JWT identifica o
usuário como seller ao cadastrar um produto e como buyer ao realizar uma
compra. Não é necessário adicionar usuários a grupos manualmente no Cognito.

## Nomes sugeridos

| Recurso | Nome |
| --- | --- |
| User pool | `residencia-foundation-users` |
| API Gateway HTTP API | `residencia-foundation-http-api` |
| Tabela DynamoDB | `residencia-foundation-marketplace` |
| Lambda de catálogo | `catalog-backend-api-lambda` |
| Lambda de pedidos | `order-backend-api-lambda` |
| Lambda processadora | `order-processor-lambda` |
| Bucket de imagens | `residencia-foundation-product-images-<account-id>` |
| Fila principal | `order-events-queue` |
| Dead-letter queue | `order-events-dlq` |

## Tabela DynamoDB

Crie a tabela com billing mode **On-demand** e apenas uma chave:

| Nome | Tipo | Uso |
| --- | --- | --- |
| `pk` | String | Partition key da tabela |

Não há sort key nem GSI nesta sprint. Os produtos são gravados com
`pk=PRODUCT#<id>` e os pedidos com `pk=ORDER#<id>`. As listagens usam `Scan`
com filtros, uma decisão intencional para manter o laboratório simples. Esse
acesso não é o desenho indicado para uma tabela grande e será substituído pela
camada de RDS em uma sprint posterior.

A Lambda processadora usa `TransactWriteItems` para que a baixa do estoque e a
criação do pedido aconteçam juntas.

Cada item de produto mantém `imageKeys`, uma lista com até oito chaves do S3.
A Lambda de catálogo gera uma URL de upload para cada arquivo e URLs temporárias
de leitura para montar o carrossel no frontend.

## Rotas do API Gateway

Todas as rotas usam o JWT authorizer do Cognito.

| Método | Rota | Integração |
| --- | --- | --- |
| `GET` | `/products` | Lambda de catálogo |
| `POST` | `/products` | Lambda de catálogo |
| `PUT` | `/products/{id}` | Lambda de catálogo |
| `DELETE` | `/products/{id}` | Lambda de catálogo |
| `GET` | `/orders` | Lambda de pedidos |
| `POST` | `/orders` | Lambda de pedidos |
| `GET` | `/seller/orders` | Lambda de pedidos |

As quatro operações de produto continuam na mesma Lambda de catálogo. Configure
CORS na HTTP API com a origem do CloudFront, os métodos `GET`, `POST`, `PUT`,
`DELETE` e `OPTIONS`, e os cabeçalhos `Authorization` e `Content-Type`.

## Variáveis de ambiente

### Lambda de catálogo

```env
DATA_SOURCE=dynamodb
MARKETPLACE_TABLE_NAME=residencia-foundation-marketplace
PRODUCT_IMAGES_BUCKET=residencia-foundation-product-images-<account-id>
UPLOAD_URL_TTL_SECONDS=900
DOWNLOAD_URL_TTL_SECONDS=3600
```

### Lambda de pedidos

```env
DATA_SOURCE=dynamodb
MARKETPLACE_TABLE_NAME=residencia-foundation-marketplace
ORDER_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/<account-id>/order-events-queue
```

### Lambda processadora

```env
DATA_SOURCE=dynamodb
MARKETPLACE_TABLE_NAME=residencia-foundation-marketplace
```

## Permissões mínimas

- catálogo: `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:DeleteItem`,
  `dynamodb:Scan`, `s3:PutObject`, `s3:GetObject` e `s3:DeleteObject` nos
  recursos do laboratório;
- pedidos: `dynamodb:GetItem`, `dynamodb:Scan` e `sqs:SendMessage`;
- processadora: `dynamodb:GetItem`, `dynamodb:TransactWriteItems` e permissão
  para consumir a fila por meio do event source mapping;
- CloudWatch Logs para as três funções.

O bucket deve aceitar PUT pelo CORS da origem do frontend, com o cabeçalho
`Content-Type`. Ele continua privado: upload e leitura são feitos por URLs
pré-assinadas de curta duração.

## Handlers

```text
01-catalog-backend-api-lambda: index.handler
02-order-backend-api-lambda:   Residencia.Foundation.Orders::Residencia.Foundation.Orders.Function::FunctionHandler
03-order-processor-lambda:     index.handler
```

## Empacotamento

Cada Lambda possui sua própria pasta, sua própria saída `dist` e seu próprio
ZIP. Nas Lambdas TypeScript, `npm run build` transpila e reúne o código e as
dependências em `dist/index.mjs`. Compacte o **conteúdo** de `dist`, para que
`index.mjs` fique na raiz do ZIP:

```bash
cd backend/lambdas/01-catalog-backend-api-lambda
npm install
npm run build
cd dist && zip -r ../catalog-backend-api-lambda.zip . && cd ..

cd ../03-order-processor-lambda
npm install
npm run build
cd dist && zip -r ../order-processor-lambda.zip . && cd ..
```

A Lambda de pedidos permanece em .NET 8. Nela, `dotnet publish` gera os
artefatos compilados e as dependências em `dist`; compacte também o conteúdo
da pasta, não a pasta em si:

```bash
cd backend/lambdas/02-order-backend-api-lambda
rm -rf dist order-backend-api-lambda.zip
dotnet publish OrderBackendApi.csproj --configuration Release --output dist
cd dist && zip -r ../order-backend-api-lambda.zip . && cd ..
```

Como atalho, execute `./backend/package.sh` na raiz do repositório. Ele repete
os três fluxos e deixa cada ZIP dentro da pasta da Lambda correspondente.

## Opcional: Layer para o driver PostgreSQL

O build normal é autocontido: o `esbuild` inclui no `index.mjs` tanto os
módulos do AWS SDK usados pela função quanto o pacote `pg`. O runtime Node.js 22
também oferece o AWS SDK v3, mas manter as versões usadas dentro do pacote dá
previsibilidade às atualizações. Portanto, não crie uma Layer apenas para os
módulos AWS deste laboratório.

Uma Layer passa a fazer sentido para a dependência externa `pg`, compartilhada
pelos adapters RDS das Lambdas TypeScript de catálogo e processamento. Ela não
se aplica à Lambda de pedidos, que usa .NET 8 e `Npgsql`.

O script abaixo cria a estrutura `nodejs/node_modules` exigida pela Lambda,
instala `pg`, gera o ZIP da Layer e recompila as duas funções TypeScript sem
duplicar `pg` nos seus pacotes. Nenhuma alteração no código-fonte é necessária:

```bash
./backend/package-postgres-layer.sh
```

Publique `backend/layers/postgres-nodejs/postgres-nodejs-layer.zip` como uma
Layer compatível com Node.js 22, anexe a mesma versão somente às funções
`catalog-backend-api-lambda` e `order-processor-lambda` e envie novamente os
ZIPs gerados pelo script. Enquanto `DATA_SOURCE=dynamodb`, valide o fluxo atual;
quando o adapter RDS for ativado, o import de `pg` será resolvido pela Layer.
