# Backend do marketplace

`O backend` da Sprint 2 é entregue pronto para que o laboratório fique concentrado
na infraestrutura AWS. Cada Lambda possui seu próprio package e pode ser
publicada separadamente.

## Nomes dos recursos

| Recurso | Nome |
| --- | --- |
| Lambda de catálogo | `catalog-backend-api-lambda` |
| Lambda de pedidos | `order-backend-api-lambda` |
| Lambda processadora | `order-processor-lambda` |
| Fila principal | `order-events-queue` |
| Dead-letter queue | `order-events-dlq` |
| API Gateway HTTP API | `residencia-foundation-http-api` |

## Data source

Todas as Lambdas aceitam `DATA_SOURCE=mock` ou `DATA_SOURCE=rds`.

- `mock`: usa os dados incluídos no package e não exige banco.
- `rds`: usa PostgreSQL por meio das variáveis `DB_HOST`, `DB_PORT`, `DB_NAME`,
  `DB_USER`, `DB_PASSWORD` e `DB_SSL`.

Na Sprint 2, use `mock`. A opção `rds` será conectada na Sprint 3.

## Handlers

```text
01-catalog-backend-api-lambda: src/index.handler
02-order-backend-api-lambda:   Residencia.Foundation.Orders::Residencia.Foundation.Orders.Function::FunctionHandler
03-order-processor-lambda:     src/index.handler
```

## Empacotamento

Execute o script a partir da raiz do repositório:

```bash
./backend/package.sh
```

Os três packages serão criados em `backend/dist`. O script valida e compila as
Lambdas TypeScript, mantém apenas as dependências de produção nos ZIPs e publica
a Lambda .NET para o target framework `.NET 8`.
