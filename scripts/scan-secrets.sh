#!/usr/bin/env bash
# Scans the files git tracks for things that look like committed credentials.
# No dependencies. Exit 1 if anything is found. Run by CI on every push and pull request,
# and safe to run by hand or as a pre-commit hook:  ./scripts/scan-secrets.sh
#
# It catches the obvious: private keys, well-known token formats, database URLs with a
# real-looking password, and `password = "long literal"` assignments. It is not a
# substitute for GitHub secret scanning with push protection, which knows far more formats
# and checks before a push lands; turn that on too. To allow a deliberate line (a test
# fixture, say), put `secret-scan: allow` in a comment on that line.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

fail=0
report() { echo "::error::$1"; echo "  $1"; fail=1; }

# 1. Files that should never be tracked.
while IFS= read -r f; do
  base="${f##*/}"   # the name, wherever the file sits
  case "$base" in
    .env.example|*.example) ;;
    .env|.env.*|*.pem|*.key|*.p12|*.pfx|*id_rsa*|*id_ed25519*|*.keystore|*credentials*.json) report "tracked file that should not be committed: $f" ;;
  esac
done < <(git ls-files)

# 2. Patterns, in tracked text files only. The scanner itself, the lockfile and the
#    runbook's example commands are skipped.
files=$(git ls-files | grep -vE '^(package-lock\.json|scripts/scan-secrets\.sh|DEPLOY-RUNBOOK\.md)$' | grep -vE '\.(png|jpg|jpeg|gif|ico|woff2?|pdf|zip)$' || true)
patterns=(
  '-----BEGIN ([A-Z]+ )?PRIVATE KEY-----'
  'AKIA[0-9A-Z]{16}'
  'ASIA[0-9A-Z]{16}'
  'gh[pousr]_[A-Za-z0-9]{36,}'
  'github_pat_[A-Za-z0-9_]{40,}'
  'xox[baprs]-[A-Za-z0-9-]{10,}'
  '[sr]k_live_[A-Za-z0-9]{20,}'
  'AIza[0-9A-Za-z_-]{35}'
  'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}'
  'postgres(ql)?://[^:/@[:space:]]+:[^@[:space:]]{3,}@[^[:space:]]+'
  '(password|passwd|secret|token|api_?key)[A-Za-z_]*[[:space:]]*[:=][[:space:]]*["'"'"'][A-Za-z0-9+/=_.-]{20,}["'"'"']'
)
for p in "${patterns[@]}"; do
  # shellcheck disable=SC2086
  hits=$(echo "$files" | xargs -r grep -nIiE -e "$p" 2>/dev/null \
    | grep -v 'secret-scan: allow' \
    | grep -viE 'USER:PASSWORD|postgres:postgres@(localhost|127\.0\.0\.1)|process\.env|example\.(com|org)|set-a-|placeholder|CHANGE_ME|xxxx' || true)
  if [ -n "$hits" ]; then
    while IFS= read -r line; do report "possible secret (${p:0:28}…): ${line:0:140}"; done <<< "$hits"
  fi
done

if [ "$fail" -eq 0 ]; then echo "secret scan: clean ($(echo "$files" | wc -l | tr -d ' ') files)"; fi
exit "$fail"
