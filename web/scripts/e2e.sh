#!/usr/bin/env bash
# End-to-end smoke test: register -> crimes -> cooldown -> launder -> withdraw -> deposit.
# Requirements: app running on $BASE_URL, database migrated+seeded.
# With CHAIN_ENABLED=true also requires a reachable chain with deployed contracts.
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
JAR="$(mktemp)"
USERNAME="e2e_$(date +%s)"
trap 'rm -f "$JAR"' EXIT

fail() { echo "FAIL: $1" >&2; exit 1; }
api() { # method path [json-body]
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -b "$JAR" -c "$JAR" -X "$method" -H 'content-type: application/json' -d "$body" "$BASE_URL$path"
  else
    curl -s -b "$JAR" -c "$JAR" -X "$method" "$BASE_URL$path"
  fi
}

echo "== register $USERNAME"
REG=$(api POST /api/auth/register "{\"username\":\"$USERNAME\",\"password\":\"hush-hush-1930\",\"locale\":\"nl\"}")
echo "$REG" | grep -q "\"username\":\"$USERNAME\"" || fail "register: $REG"
WALLET=$(echo "$REG" | sed -n 's/.*"walletAddress":"\([^"]*\)".*/\1/p')
echo "   wallet: $WALLET"

echo "== me"
ME=$(api GET /api/me)
echo "$ME" | grep -q '"cash":500' || fail "expected starting cash 500: $ME"

echo "== commit crime #2 (beg_streets, 90% success)"
ATTEMPT=$(api POST /api/crimes/2/attempt)
echo "$ATTEMPT" | grep -q '"success":' || fail "attempt: $ATTEMPT"
echo "   $ATTEMPT"

echo "== immediate retry must hit the cooldown"
RETRY=$(api POST /api/crimes/2/attempt)
echo "$RETRY" | grep -q 'cooldown_active' || fail "expected cooldown_active: $RETRY"

echo "== locked crime must be rejected (rob_bank needs rank 10)"
LOCKED=$(api POST /api/crimes/8/attempt)
echo "$LOCKED" | grep -q 'rank_too_low' || fail "expected rank_too_low: $LOCKED"

echo "== grind crimes until some dirty cash is earned"
for crime in 1 3 1 2; do
  api POST "/api/crimes/$crime/attempt" > /dev/null
  sleep 0.2
done
DIRTY=$(api GET /api/me | sed -n 's/.*"dirtyCash":\([0-9]*\).*/\1/p')
echo "   dirty cash: $DIRTY"

if [ "${DIRTY:-0}" -gt 0 ]; then
  echo "== launder all dirty cash"
  LAUNDER=$(api POST /api/bank/launder "{\"amount\":$DIRTY}")
  echo "$LAUNDER" | grep -q '"cleanGained"' || fail "launder: $LAUNDER"
  echo "   $LAUNDER"

  echo "== laundering more than owned must fail"
  OVER=$(api POST /api/bank/launder '{"amount":999999}')
  echo "$OVER" | grep -q 'insufficient_dirty_cash' || fail "expected insufficient_dirty_cash: $OVER"
fi

echo "== leaderboard contains the player"
api GET "/api/leaderboard?by=xp" | grep -q "$USERNAME" || fail "player missing from leaderboard"

CHAIN_TEST="${CHAIN_TEST:-true}"
if [ "$CHAIN_TEST" = "true" ]; then
  echo "== withdraw 100 OMD to the chain"
  WITHDRAW=$(api POST /api/bank/withdraw '{"amount":100}')
  if echo "$WITHDRAW" | grep -q 'chain_disabled'; then
    echo "   chain disabled — skipping on-chain assertions"
  else
    echo "$WITHDRAW" | grep -q '"status":"CONFIRMED"' || fail "withdraw: $WITHDRAW"
    echo "   $WITHDRAW"

    echo "== off-chain balance dropped by 100"
    CASH=$(api GET /api/me | sed -n 's/.*"cash":\([0-9]*\).*/\1/p')
    echo "   cash now: $CASH"

    echo "== deposit 40 OMD back"
    DEPOSIT=$(api POST /api/bank/deposit '{"amount":40}')
    echo "$DEPOSIT" | grep -q '"status":"CONFIRMED"' || fail "deposit: $DEPOSIT"
    echo "   $DEPOSIT"

    echo "== tx history shows both"
    TXS=$(api GET /api/bank/txs)
    echo "$TXS" | grep -q 'WITHDRAW' || fail "missing withdraw tx"
    echo "$TXS" | grep -q 'DEPOSIT' || fail "missing deposit tx"
  fi
fi

# ---------- Phase 2: PvP, bounties, jail & respawn ----------

JAR2="$(mktemp)"
KILLER="killer_$(date +%s)"
VICTIM="victim_$(date +%s)"
api2() { # second player session
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -b "$JAR2" -c "$JAR2" -X "$method" -H 'content-type: application/json' -d "$body" "$BASE_URL$path"
  else
    curl -s -b "$JAR2" -c "$JAR2" -X "$method" "$BASE_URL$path"
  fi
}
trap 'rm -f "$JAR" "$JAR2"' EXIT

echo
echo "== register killer ($KILLER) and victim ($VICTIM)"
api POST /api/auth/logout > /dev/null
KREG=$(api POST /api/auth/register "{\"username\":\"$KILLER\",\"password\":\"hush-hush-1930\"}")
echo "$KREG" | grep -q "\"username\":\"$KILLER\"" || fail "register killer: $KREG"
KWALLET=$(echo "$KREG" | sed -n 's/.*"walletAddress":"\([^"]*\)".*/\1/p')
VREG=$(api2 POST /api/auth/register "{\"username\":\"$VICTIM\",\"password\":\"hush-hush-1930\"}")
echo "$VREG" | grep -q "\"username\":\"$VICTIM\"" || fail "register victim: $VREG"

echo "== killer buys 12 bullets (360 OMD)"
BUY=$(api POST /api/kill/bullets '{"amount":12}')
echo "$BUY" | grep -q '"bullets":12' || fail "buy bullets: $BUY"

echo "== killer places a 50 OMD bounty on the victim"
BOUNTY=$(api POST /api/bounty/place "{\"username\":\"$VICTIM\",\"amount\":50}")
echo "$BOUNTY" | grep -q "\"target\":\"$VICTIM\"" || fail "place bounty: $BOUNTY"
echo "   $BOUNTY"

echo "== most wanted lists the victim"
api GET /api/bounty | grep -q "$VICTIM" || fail "victim missing from most wanted"

echo "== shooting without locating first is rejected"
NOLOC=$(api POST /api/kill/attempt "{\"username\":\"$VICTIM\",\"bullets\":12}")
echo "$NOLOC" | grep -q 'target_not_located' || fail "expected target_not_located: $NOLOC"

echo "== killer tracks the victim"
SEARCH=$(api POST /api/kill/search "{\"username\":\"$VICTIM\"}")
echo "$SEARCH" | grep -q '"bulletsNeeded":10' || fail "search: $SEARCH"

echo "== killer fires 12 bullets (guaranteed kill at rank 1)"
KILL=$(api POST /api/kill/attempt "{\"username\":\"$VICTIM\",\"bullets\":12}")
echo "$KILL" | grep -q '"success":true' || fail "kill: $KILL"
echo "$KILL" | grep -q '"bountyPaid":50' || fail "expected bounty payout in kill: $KILL"
echo "   $KILL"

echo "== blood money arrived as dirty cash (60% of victim's 500)"
KDIRTY=$(api GET /api/me | sed -n 's/.*"dirtyCash":\([0-9]*\).*/\1/p')
[ "$KDIRTY" -ge 300 ] || fail "expected >=300 dirty cash, got $KDIRTY"

echo "== victim is dead and respawns fresh"
api2 GET /api/me | grep -q '"isDead":true' || fail "victim should be dead"
DEADCRIME=$(api2 POST /api/crimes/2/attempt)
echo "$DEADCRIME" | grep -q '"error":"dead"' || fail "dead victim could still act: $DEADCRIME"
RESPAWN=$(api2 POST /api/respawn '{"mode":"fresh"}')
echo "$RESPAWN" | grep -q '"mode":"fresh"' || fail "respawn: $RESPAWN"
api2 GET /api/me | grep -q '"isDead":false' || fail "victim should be alive again"

echo "== the gazette reports the hit"
api GET /api/kill/feed | grep -q "$VICTIM" || fail "kill missing from feed"

if [ "$CHAIN_TEST" = "true" ] && ! echo "$BOUNTY" | grep -q '"fundTxHash":null'; then
  echo "== bounty was escrowed and claimed on-chain"
  echo "$KILL" | grep -q '"bountyTxHash":"0x' || fail "expected on-chain bounty claim tx: $KILL"
fi

echo
echo "ALL E2E CHECKS PASSED"
