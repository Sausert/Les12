#!/usr/bin/env bash
# Generates fresh production secrets for Sonic Omerta.
# Prints them once — store them in a password manager, never commit them.
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d web/node_modules/viem ]; then
  echo "Run 'npm install' in web/ first (viem is needed for the treasury key)." >&2
  exit 1
fi

SESSION_SECRET=$(openssl rand -hex 32)
WALLET_ENC_KEY=$(openssl rand -hex 32)
ADMIN_SECRET=$(openssl rand -hex 24)

TREASURY=$(cd web && node -e "
const { generatePrivateKey, privateKeyToAccount } = require('viem/accounts');
const key = generatePrivateKey();
console.log(key + ' ' + privateKeyToAccount(key).address);
")
TREASURY_KEY=$(echo "$TREASURY" | cut -d' ' -f1)
TREASURY_ADDR=$(echo "$TREASURY" | cut -d' ' -f2)

cat << EOF

Sonic Omerta — productiegeheimen (bewaar deze veilig, toon ze nooit opnieuw)
============================================================================

SESSION_SECRET="$SESSION_SECRET"
WALLET_ENC_KEY="$WALLET_ENC_KEY"
ADMIN_SECRET="$ADMIN_SECRET"
TREASURY_PRIVATE_KEY="$TREASURY_KEY"

Treasury-adres (voor de faucet op https://testnet.soniclabs.com):
  $TREASURY_ADDR

Volgende stappen: zie DEPLOYMENT.md stap 2 t/m 6.
EOF
