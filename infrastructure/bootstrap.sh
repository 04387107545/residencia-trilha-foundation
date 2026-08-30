#!/usr/bin/env bash

# Stop on errors, undefined variables and failed pipelines.
set -euo pipefail

usage() {
  cat <<'EOF'
Uso:
  ./bootstrap.sh <plan|apply|destroy> <profile> [argumentos do terraform]

Variáveis de ambiente:
  RESIDENCIA_STATE_BUCKET  Bucket S3 de remote state (obrigatório)
  RESIDENCIA_REGION        Região AWS (padrão: us-east-1)

Exemplo:
  RESIDENCIA_STATE_BUCKET=my-state-bucket \
    ./bootstrap.sh apply ready-for-sprint-06
EOF
}

fail() {
  echo "$1" >&2
  exit 1
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

# 1. Identify the Terraform action requested by the student.
action="$1"

# 2. Identify the profile that represents the desired sprint starting point.
profile_name="$2"
shift 2

# 3. Validate the action and the only required local dependency.
case "$action" in
  plan | apply | destroy) ;;
  *)
    usage
    fail "Ação inválida: $action"
    ;;
esac

command -v terraform >/dev/null 2>&1 || fail "Dependência não encontrada: terraform"

# 4. Locate the profile and resolve the AWS region.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
profile_path="${script_dir}/profiles/${profile_name}.yaml"
aws_region="${RESIDENCIA_REGION:-us-east-1}"
state_bucket="${RESIDENCIA_STATE_BUCKET:-}"

[[ -f "$profile_path" ]] || fail "Profile não encontrado: $profile_path"

# 5. Read the stacks enabled by the profile, without requiring a YAML tool.
stack_list="$(
  awk '
    /^stacks:/ { reading_stacks = 1; next }
    reading_stacks && $2 == "true" {
      gsub(/[":]/, "", $1)
      print $1
    }
  ' "$profile_path" |
    sort
)"

if [[ -z "$stack_list" ]]; then
  echo "O profile $profile_name não seleciona nenhuma stack."
  exit 0
fi

[[ -n "$state_bucket" ]] || fail \
  "Defina RESIDENCIA_STATE_BUCKET com o bucket criado pela foundation."

# 6. Define the execution order. Destroy always runs in reverse.
if [[ "$action" == "destroy" ]]; then
  stack_list="$(printf '%s\n' "$stack_list" | sort -r)"
fi

while IFS= read -r stack_name; do
  stack_dir="${script_dir}/stacks/${stack_name}"

  # 7. Confirm that the selected stack exists and has Terraform code.
  [[ -d "$stack_dir" ]] || fail "Diretório da stack não encontrado: $stack_dir"

  if [[ -z "$(find "$stack_dir" -maxdepth 1 -type f -name '*.tf' -print -quit)" ]]; then
    fail "Stack ainda não implementada: $stack_name"
  fi

  echo "==> $action $stack_name"

  # 8. Initialize the stack with an independent state key in the shared bucket.
  terraform -chdir="$stack_dir" init \
    -reconfigure \
    -input=false \
    -backend-config="bucket=${state_bucket}" \
    -backend-config="key=residencia/${stack_name}.tfstate" \
    -backend-config="region=${aws_region}" \
    -backend-config="use_lockfile=true"

  # 9. Run the requested action and forward any additional CLI arguments.
  terraform -chdir="$stack_dir" "$action" \
    -input=false \
    -var="aws_region=${aws_region}" \
    "$@"
done <<< "$stack_list"
