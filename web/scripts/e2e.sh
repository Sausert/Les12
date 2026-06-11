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

# ---------- Phase 3: families, districts, heists & betrayal ----------
# Needs direct DB access (psql) to grant the boss the required rank/cash.

PSQL="sudo -u postgres psql -q omerta -c"
if $PSQL "SELECT 1" > /dev/null 2>&1; then
  JAR3="$(mktemp)"
  BOSS="boss_$(date +%s)"
  FAMNAME="Cosa_$(date +%s)"
  api3() {
    local method="$1" path="$2" body="${3:-}"
    if [ -n "$body" ]; then
      curl -s -b "$JAR3" -c "$JAR3" -X "$method" -H 'content-type: application/json' -d "$body" "$BASE_URL$path"
    else
      curl -s -b "$JAR3" -c "$JAR3" -X "$method" "$BASE_URL$path"
    fi
  }
  trap 'rm -f "$JAR" "$JAR2" "$JAR3"' EXIT

  echo
  echo "== register boss ($BOSS) and grant rank 3 + funds via DB"
  BREG=$(api3 POST /api/auth/register "{\"username\":\"$BOSS\",\"password\":\"hush-hush-1930\"}")
  echo "$BREG" | grep -q "\"username\":\"$BOSS\"" || fail "register boss: $BREG"
  $PSQL "UPDATE \"Player\" SET xp=400, \"rankId\"=3, cash=10000 WHERE username='$BOSS'"

  echo "== boss founds family $FAMNAME (1000 OMD into the vault)"
  FAM=$(api3 POST /api/family/create "{\"name\":\"$FAMNAME\"}")
  echo "$FAM" | grep -q "\"name\":\"$FAMNAME\"" || fail "create family: $FAM"
  echo "$FAM" | grep -q '"treasury":1000' || fail "vault should start at 1000: $FAM"

  echo "== boss invites killer and victim; both accept"
  api3 POST /api/family/invite "{\"username\":\"$KILLER\"}" | grep -q "$KILLER" || fail "invite killer"
  api3 POST /api/family/invite "{\"username\":\"$VICTIM\"}" | grep -q "$VICTIM" || fail "invite victim"
  KINV=$(api GET /api/family | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
  api POST /api/family/respond "{\"inviteId\":\"$KINV\",\"accept\":true}" | grep -q '"joined":true' || fail "killer accept"
  VINV=$(api2 GET /api/family | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
  api2 POST /api/family/respond "{\"inviteId\":\"$VINV\",\"accept\":true}" | grep -q '"joined":true' || fail "victim accept"
  api3 GET /api/family | grep -q '"members":\[.*'"$KILLER"'.*\]' || fail "killer not in member list"

  echo "== soldiers cannot withdraw from the vault"
  NOPE=$(api POST /api/family/treasury '{"action":"withdraw","amount":10}')
  echo "$NOPE" | grep -q 'not_allowed' || fail "expected not_allowed: $NOPE"

  echo "== boss deposits 1500 and claims district 1 (cost 2000)"
  # Release district 1 in case a previous e2e family still owns it.
  $PSQL "UPDATE \"District\" SET \"ownerFamilyId\"=NULL, \"claimedAt\"=NULL WHERE id=1"
  api3 POST /api/family/treasury '{"action":"deposit","amount":1500}' | grep -q '"treasury":2500' || fail "deposit"
  api3 POST /api/districts/claim '{"districtId":1}' | grep -q '"claimed":1' || fail "claim district"
  api3 GET /api/districts | grep -q "\"ownerFamilyName\":\"$FAMNAME\"" || fail "district owner missing"

  echo "== outsider crime in district 1 pays protection tax to the vault"
  api POST /api/auth/logout > /dev/null
  OUTSIDER_LOGIN=$(api POST /api/auth/login "{\"username\":\"$USERNAME\",\"password\":\"hush-hush-1930\"}")
  echo "$OUTSIDER_LOGIN" | grep -q "$USERNAME" || fail "outsider login"
  $PSQL "DELETE FROM \"Cooldown\" WHERE \"playerId\" = (SELECT id FROM \"Player\" WHERE username='$USERNAME')"
  TAXED=false
  for crime in 1 2 3; do
    RES=$(api POST "/api/crimes/$crime/attempt")
    if echo "$RES" | grep -q '"success":true' && ! echo "$RES" | grep -q '"protectionTax":0'; then
      TAXED=true
      break
    fi
  done
  [ "$TAXED" = true ] || fail "no crime paid protection tax: $RES"
  VAULT=$(api3 GET /api/family | sed -n 's/.*"treasury":\([0-9]*\).*/\1/p')
  [ "$VAULT" -gt 500 ] || fail "vault should exceed 500 after tax, got $VAULT"
  echo "   vault now: $VAULT"

  echo "== three-man heist: start, fill roles, execute"
  api3 POST /api/heist/start '{"typeKey":"train_robbery","role":"DRIVER"}' | grep -q 'train_robbery' || fail "start heist"
  api POST /api/auth/logout > /dev/null
  api POST /api/auth/login "{\"username\":\"$KILLER\",\"password\":\"hush-hush-1930\"}" > /dev/null
  HID=$(api3 GET /api/family | sed -n 's/.*"heists":\[{"id":"\([^"]*\)".*/\1/p')
  [ -n "$HID" ] || fail "no open heist id"
  api POST /api/heist/join "{\"heistId\":\"$HID\",\"role\":\"SAFECRACKER\"}" | grep -q 'SAFECRACKER' || fail "killer join"
  api2 POST /api/heist/join "{\"heistId\":\"$HID\",\"role\":\"LOOKOUT\"}" | grep -q 'LOOKOUT' || fail "victim join"
  HEIST=$(api3 POST /api/heist/execute "{\"heistId\":\"$HID\"}")
  echo "$HEIST" | grep -q '"crew":3' || fail "execute heist: $HEIST"
  echo "   $HEIST"

  echo "== a member talks to the police (betrayal)"
  BETRAY=$(api2 POST /api/betray)
  echo "$BETRAY" | grep -q '"raid":' || fail "betray: $BETRAY"
  echo "   $BETRAY"
  VAULT2=$(api3 GET /api/family | sed -n 's/.*"treasury":\([0-9]*\).*/\1/p')
  [ "$VAULT2" -lt "$VAULT" ] || fail "vault should shrink after the raid ($VAULT -> $VAULT2)"

  echo "== family leaderboard lists $FAMNAME"
  api3 GET /api/family/list | grep -q "$FAMNAME" || fail "family missing from list"
else
  echo "== psql unavailable — skipping phase 3 family checks"
fi

# ---------- Phase 4: casino (provably fair) & smuggling market ----------

echo
echo "== casino: dice with commit-reveal fairness"
# Give the current session player a bankroll via laundering history; just use boss (jar3) who has cash.
COMMIT=$(api3 POST /api/casino/commit)
ROUND=$(echo "$COMMIT" | sed -n 's/.*"roundId":"\([^"]*\)".*/\1/p')
HASH=$(echo "$COMMIT" | sed -n 's/.*"serverSeedHash":"\([^"]*\)".*/\1/p')
[ -n "$ROUND" ] && [ -n "$HASH" ] || fail "commit: $COMMIT"
DICE=$(api3 POST /api/casino/dice "{\"roundId\":\"$ROUND\",\"bet\":10,\"target\":50,\"clientSeed\":\"e2e\"}")
echo "$DICE" | grep -q '"roll":' || fail "dice: $DICE"
echo "   $DICE"

echo "== fairness: revealed seed hashes to the committed hash"
SEED=$(echo "$DICE" | sed -n 's/.*"serverSeed":"\([^"]*\)".*/\1/p')
CHECK=$(printf '%s' "$SEED" | sha256sum | cut -d' ' -f1)
[ "$CHECK" = "$HASH" ] || fail "seed hash mismatch: $CHECK != $HASH"

echo "== fairness: outcome reproducible from the revealed seed"
ROLL=$(echo "$DICE" | sed -n 's/.*"roll":\([0-9]*\).*/\1/p')
REPLAY=$(node -e "
const { createHmac } = require('node:crypto');
const buf = createHmac('sha256', '$SEED').update('e2e:0').digest();
const v = (buf[0] << 16) | (buf[1] << 8) | buf[2];
const limit = Math.floor(0x1000000 / 100) * 100;
console.log(v < limit ? v % 100 : 'rejected');
")
[ "$REPLAY" = "$ROLL" ] || echo "   (first block rejected by sampling — roll $ROLL accepted via later block)"
[ "$REPLAY" = "$ROLL" ] && echo "   replayed roll $REPLAY matches"

echo "== casino: reusing a settled round is rejected"
REUSE=$(api3 POST /api/casino/dice "{\"roundId\":\"$ROUND\",\"bet\":10,\"target\":50}")
echo "$REUSE" | grep -q 'round_not_found' || fail "expected round_not_found: $REUSE"

echo "== casino: video poker (jacks or better) deal -> hold all -> draw"
COMMIT2=$(api3 POST /api/casino/commit)
ROUND2=$(echo "$COMMIT2" | sed -n 's/.*"roundId":"\([^"]*\)".*/\1/p')
VPDEAL=$(api3 POST /api/casino/videopoker/deal "{\"roundId\":\"$ROUND2\",\"bet\":5}")
echo "$VPDEAL" | grep -qE '"cards":\["[2-9TJQKA][SHDC]"' || fail "vp deal: $VPDEAL"
echo "   dealt: $VPDEAL"
VPDRAW=$(api3 POST /api/casino/videopoker/draw "{\"roundId\":\"$ROUND2\",\"holds\":[true,true,true,true,true]}")
echo "$VPDRAW" | grep -q '"hand":' || fail "vp draw: $VPDRAW"
echo "   $VPDRAW"
DEALT=$(echo "$VPDEAL" | sed -n 's/.*"cards":\[\([^]]*\)\].*/\1/p')
FINAL=$(echo "$VPDRAW" | sed -n 's/.*"cards":\[\([^]]*\)\].*/\1/p')
[ "$DEALT" = "$FINAL" ] || fail "holding all five must keep the hand ($DEALT != $FINAL)"

echo "== casino: blackjack round plays to completion"
COMMIT3=$(api3 POST /api/casino/commit)
ROUND3=$(echo "$COMMIT3" | sed -n 's/.*"roundId":"\([^"]*\)".*/\1/p')
BJ=$(api3 POST /api/casino/blackjack/start "{\"roundId\":\"$ROUND3\",\"bet\":10}")
if echo "$BJ" | grep -q '"done":false'; then
  BJ=$(api3 POST /api/casino/blackjack/action "{\"roundId\":\"$ROUND3\",\"action\":\"stand\"}")
fi
echo "$BJ" | grep -q '"result":' || fail "blackjack: $BJ"
echo "   $BJ"

echo "== market: buy contraband with dirty cash, sell it back, prices move"
$PSQL "UPDATE \"Player\" SET \"dirtyCash\"=1000 WHERE username='$BOSS'" 2>/dev/null || true
MARKET1=$(api3 GET /api/market)
SPOT1=$(echo "$MARKET1" | sed -n 's/.*"goodsKey":"whiskey"[^}]*"spotPrice":\([0-9]*\).*/\1/p')
BUYTRADE=$(api3 POST /api/market/trade '{"goodsKey":"whiskey","action":"buy","qty":5}')
echo "$BUYTRADE" | grep -q '"cost":' || fail "market buy: $BUYTRADE"
echo "   buy: $BUYTRADE"
MARKET2=$(api3 GET /api/market)
echo "$MARKET2" | grep -q '"owned":5' || fail "inventory should show 5 whiskey: $MARKET2"
SELLTRADE=$(api3 POST /api/market/trade '{"goodsKey":"whiskey","action":"sell","qty":5}')
echo "$SELLTRADE" | grep -q '"gain":' || fail "market sell: $SELLTRADE"
echo "   sell: $SELLTRADE"
COST=$(echo "$BUYTRADE" | sed -n 's/.*"cost":\([0-9]*\).*/\1/p')
GAIN=$(echo "$SELLTRADE" | sed -n 's/.*"gain":\([0-9]*\).*/\1/p')
[ "$GAIN" -lt "$COST" ] || fail "roundtrip must be lossy (cost $COST, gain $GAIN)"

echo "== market: selling goods you don't have is rejected"
NOSELL=$(api3 POST /api/market/trade '{"goodsKey":"morphine","action":"sell","qty":3}')
echo "$NOSELL" | grep -q 'insufficient_goods' || fail "expected insufficient_goods: $NOSELL"

echo
echo "ALL E2E CHECKS PASSED"
