#!/usr/bin/env bash

set -euo pipefail

backend_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
layer_dir="${backend_dir}/layers/postgres-nodejs"
catalog_dir="${backend_dir}/lambdas/01-catalog-backend-api-lambda"
processor_dir="${backend_dir}/lambdas/03-order-processor-lambda"

rm -rf "${layer_dir}"
mkdir -p "${layer_dir}/nodejs"

# pg is JavaScript puro. O diretório nodejs/node_modules é reconhecido
# automaticamente pelo runtime Node.js quando a Layer é anexada à função.
npm install --prefix "${layer_dir}/nodejs" --package-lock=false --no-save pg@8
(
  cd "${layer_dir}"
  zip -qr postgres-nodejs-layer.zip nodejs
)

for lambda_dir in "${catalog_dir}" "${processor_dir}"; do
  npm --prefix "${lambda_dir}" ci
  npm --prefix "${lambda_dir}" run build:with-pg-layer
done

rm -f "${catalog_dir}/catalog-backend-api-lambda.zip"
(
  cd "${catalog_dir}/dist"
  zip -qr ../catalog-backend-api-lambda.zip .
)

rm -f "${processor_dir}/order-processor-lambda.zip"
(
  cd "${processor_dir}/dist"
  zip -qr ../order-processor-lambda.zip .
)

printf 'Layer: %s\n' "${layer_dir}/postgres-nodejs-layer.zip"
printf 'Rebuilt without bundled pg: %s and %s\n' \
  "${catalog_dir}/catalog-backend-api-lambda.zip" \
  "${processor_dir}/order-processor-lambda.zip"
