#!/usr/bin/env bash

set -euo pipefail

backend_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
layer_dir="${backend_dir}/layers/aws-sdk-nodejs"
catalog_dir="${backend_dir}/lambdas/01-catalog-backend-api-lambda"
processor_dir="${backend_dir}/lambdas/03-order-processor-lambda"
catalog_lock="${catalog_dir}/package-lock.json"

package_version() {
  node -e '
    const lock = require(process.argv[1]);
    const packageName = process.argv[2];
    const version = lock.packages[`node_modules/${packageName}`]?.version;
    if (!version) throw new Error(`Version not found for ${packageName}`);
    process.stdout.write(version);
  ' "${catalog_lock}" "$1"
}

rm -rf "${layer_dir}"
mkdir -p "${layer_dir}/nodejs"

client_s3_version="$(package_version '@aws-sdk/client-s3')"
client_dynamodb_version="$(package_version '@aws-sdk/client-dynamodb')"
lib_dynamodb_version="$(package_version '@aws-sdk/lib-dynamodb')"
presigner_version="$(package_version '@aws-sdk/s3-request-presigner')"

# A Layer fixa as mesmas versões já registradas no package-lock da Lambda de
# catálogo. nodejs/node_modules é um dos caminhos reconhecidos pelo Node.js 22.
npm install --prefix "${layer_dir}/nodejs" --package-lock=false --no-save \
  "@aws-sdk/client-s3@${client_s3_version}" \
  "@aws-sdk/client-dynamodb@${client_dynamodb_version}" \
  "@aws-sdk/lib-dynamodb@${lib_dynamodb_version}" \
  "@aws-sdk/s3-request-presigner@${presigner_version}"
(
  cd "${layer_dir}"
  zip -qr aws-sdk-nodejs-layer.zip nodejs
)

for lambda_dir in "${catalog_dir}" "${processor_dir}"; do
  npm --prefix "${lambda_dir}" ci
  npm --prefix "${lambda_dir}" run build:with-aws-sdk-layer
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

printf 'Layer: %s\n' "${layer_dir}/aws-sdk-nodejs-layer.zip"
printf 'Rebuilt without bundled AWS SDK: %s and %s\n' \
  "${catalog_dir}/catalog-backend-api-lambda.zip" \
  "${processor_dir}/order-processor-lambda.zip"
