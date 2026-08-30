#!/usr/bin/env bash

set -euo pipefail

backend_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
output_dir="${backend_dir}/dist"
catalog_dir="${backend_dir}/lambdas/01-catalog-backend-api-lambda"
orders_dir="${backend_dir}/lambdas/02-order-backend-api-lambda"
processor_dir="${backend_dir}/lambdas/03-order-processor-lambda"
catalog_package_dir="${output_dir}/catalog-package"
processor_package_dir="${output_dir}/processor-package"

rm -rf "${output_dir}"
mkdir -p "${output_dir}"

npm --prefix "${catalog_dir}" ci
npm --prefix "${catalog_dir}" run build
npm --prefix "${catalog_dir}" prune --omit=dev
mkdir -p "${catalog_package_dir}"
cp -R "${catalog_dir}/build/src" "${catalog_package_dir}/src"
cp -R "${catalog_dir}/fixtures" "${catalog_package_dir}/fixtures"
cp -R "${catalog_dir}/node_modules" "${catalog_package_dir}/node_modules"
cp "${catalog_dir}/package.json" "${catalog_dir}/package-lock.json" "${catalog_package_dir}/"
(
  cd "${catalog_package_dir}"
  zip -qr "${output_dir}/catalog-backend-api-lambda.zip" .
)
rm -rf "${catalog_package_dir}"

orders_publish_dir="${output_dir}/order-backend-api-lambda"
dotnet publish "${orders_dir}/OrderBackendApi.csproj" \
  --configuration Release \
  --output "${orders_publish_dir}"
(
  cd "${orders_publish_dir}"
  zip -qr "${output_dir}/order-backend-api-lambda.zip" .
)
rm -rf "${orders_publish_dir}"

npm --prefix "${processor_dir}" ci
npm --prefix "${processor_dir}" run build
npm --prefix "${processor_dir}" prune --omit=dev
mkdir -p "${processor_package_dir}"
cp -R "${processor_dir}/build/src" "${processor_package_dir}/src"
cp -R "${processor_dir}/node_modules" "${processor_package_dir}/node_modules"
cp "${processor_dir}/package.json" "${processor_dir}/package-lock.json" "${processor_package_dir}/"
(
  cd "${processor_package_dir}"
  zip -qr "${output_dir}/order-processor-lambda.zip" .
)
rm -rf "${processor_package_dir}"

printf 'Packages created in %s\n' "${output_dir}"
