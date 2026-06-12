# Deployment-handleiding — Sonic Omerta

Dit document beschrijft stap voor stap hoe je Sonic Omerta productieklaar opzet:
smart contracts op het **Sonic testnet**, de database, de webapp en het beheer
daarna. Volg de stappen in volgorde; elke stap bouwt op de vorige.

> ⚠️ Dit is een testnet-project. Zet **nooit** echt geld (mainnet) in zonder een
> security-audit van de contracten en een herziening van het custodial-walletmodel.

---

## Architectuur in het kort

```
┌─────────────┐   HTTPS   ┌──────────────────┐   SQL    ┌────────────┐
│ Speler (PWA)│ ────────► │ Next.js (web/)   │ ───────► │ PostgreSQL │
└─────────────┘           │  - game-API's    │          └────────────┘
                          │  - custodial     │
                          │    wallets       │   RPC    ┌────────────────────┐
                          │  - treasury-key  │ ───────► │ Sonic testnet      │
                          └──────────────────┘          │  7 contracten      │
                                                        └────────────────────┘
```

- **De database is de bron van waarheid voor gameplay**; de chain alleen voor
  opgenomen OMD, NFT's en escrows (bounties, veilingen, testament).
- De server bezit één **treasury-key** (MINTER_ROLE + attestor) en per speler een
  versleutelde custodial key. Beide categorieën verdienen productie-zorg (stap 1).

---

## Stap 0 — Vereisten

| Wat | Waarvoor |
|---|---|
| Node.js 22+ en npm | builds, deploy-scripts |
| Een PostgreSQL-database | [Neon](https://neon.tech) (aanbevolen, gratis tier), Supabase, of eigen server |
| Een host voor Next.js | [Vercel](https://vercel.com) (aanbevolen) of eigen VPS met Docker |
| Native **S** op Sonic testnet | gas voor de treasury — gratis via de [Sonic-faucet](https://testnet.soniclabs.com) |

---

## Stap 1 — Genereer productiegeheimen

Draai vanaf de repo-root (vereist dat `web/npm install` al is gedaan):

```bash
./scripts/generate-secrets.sh
```

Dit print vijf waarden — **bewaar ze in een wachtwoordmanager, commit ze nooit**:

| Variabele | Doel | Rotatie-impact |
|---|---|---|
| `SESSION_SECRET` | ondertekent sessie-JWT's | iedereen wordt uitgelogd |
| `WALLET_ENC_KEY` | AES-256-GCM-sleutel voor custodial privkeys | ⚠️ oude wallets onleesbaar — roteer alleen met een her-encryptiescript |
| `ADMIN_SECRET` | beveiligt `POST /api/season/end` | cron-config bijwerken |
| `TREASURY_PRIVATE_KEY` | MINTER_ROLE + EIP-712-attestor | contracten opnieuw deployen of rollen overdragen |
| (treasury-adres) | publiek adres van die key | nodig voor de faucet |

---

## Stap 2 — Database opzetten

1. Maak een Postgres-database aan (Neon: project aanmaken → connection string kopiëren).
   Gebruik de **pooled** connection string als je op Vercel deployt.
2. Draai de migraties en seed eenmalig vanaf je eigen machine:

```bash
cd web
DATABASE_URL="postgresql://…" npx prisma migrate deploy
DATABASE_URL="postgresql://…" npx prisma db seed
```

`migrate deploy` voert alleen bestaande migraties uit (geen schema-drift), de seed is
idempotent (rangen, misdaden, wijken, marktpools, itemcatalogus, seizoen 1) en reset
nooit live data zoals marktreserves.

> Verwijder in productie de twee testspelers of geef ze sterke wachtwoorden:
> `DELETE FROM "Player" WHERE username IN ('DonTesto','LuckyLuciana');`

---

## Stap 3 — Treasury financieren (Sonic testnet)

1. Ga naar de faucet: **https://testnet.soniclabs.com**
2. Vraag native **S** aan voor het treasury-adres uit stap 1.
3. Controleer het saldo op **https://testnet.sonicscan.org/address/&lt;treasury-adres&gt;**

De treasury betaalt alle gas: contract-deploys, mints, escrow-transacties en de kleine
gas-top-ups naar custodial spelerwallets. De faucet-druppels zijn klein — vraag op tijd
bij en hergebruik dezelfde key.

---

## Stap 4 — Contracten deployen naar Sonic testnet

> De RPC moet bereikbaar zijn vanaf je machine (vanuit sommige CI-/sandboxomgevingen is
> hij geblokkeerd — draai dit dan lokaal).

```bash
cd contracts
npm install
npx hardhat test                       # 17 tests moeten slagen vóór elke deploy

TREASURY_PRIVATE_KEY=0x… npx hardhat run scripts/deploy.ts --network sonicTestnet
```

De deploy zet **zeven contracten** (OmertaToken, Bank, Bounty, OmertaItems,
AuctionHouse, Testament, SeasonTrophy) en schrijft de adressen naar
`web/src/lib/chain/deployments.json`. **Commit dat bestand** — het wordt in de
serverbundel gebakken.

Verifieer de deploy direct met de smoke-test (mint 1 OMD en lees hem terug):

```bash
TREASURY_PRIVATE_KEY=0x… npx hardhat run scripts/smoke.ts --network sonicTestnet
```

Bekijk de transacties op https://testnet.sonicscan.org.

---

## Stap 5 — Webapp hosten

### Optie A — Vercel (aanbevolen)

1. Importeer de GitHub-repo in Vercel en zet **Root Directory** op `web`.
2. Zet **Build Command** op:
   ```
   npx prisma migrate deploy && npm run build
   ```
   (zo draaien nieuwe migraties automatisch mee met elke deploy)
3. Stel de environment-variabelen in (zie de tabel in stap 6).
4. Deploy. De PWA (manifest + service worker) werkt out-of-the-box over HTTPS.

### Optie B — eigen VPS met Docker

```bash
# op de server, vanaf de repo-root:
cp web/.env.example web/.env          # vul productie-waarden in (stap 6)
docker compose -f docker-compose.prod.yml up -d --build
```

`docker-compose.prod.yml` start Postgres + de webapp, draait migraties + seed bij het
opstarten en serveert op poort 3000. Zet er een reverse proxy met TLS voor
(Caddy/Traefik/nginx) — de PWA en secure cookies vereisen HTTPS.

---

## Stap 6 — Environment-variabelen (productie)

| Variabele | Waarde | Let op |
|---|---|---|
| `DATABASE_URL` | jouw Postgres-string | Neon: pooled string + `?sslmode=require` |
| `SESSION_SECRET` | uit stap 1 | min. 32 tekens |
| `WALLET_ENC_KEY` | uit stap 1 | exact 32 bytes hex (64 hex-tekens) |
| `ADMIN_SECRET` | uit stap 1 | |
| `CHAIN_ENABLED` | `true` | `false` = spel zonder chain (bank/veiling uit) |
| `CHAIN_RPC_URL` | `https://rpc.testnet.soniclabs.com` | |
| `CHAIN_ID` | `14601` | Sonic testnet |
| `TREASURY_PRIVATE_KEY` | uit stap 1 | dezelfde key als de deploy! |

> **Belangrijk:** de chain-adressen komen uit het ge-committe `deployments.json` en
> worden bij de build ingebakken. Na een nieuwe contract-deploy dus: commit + redeploy
> van de webapp.

---

## Stap 7 — Verificatie na deploy

1. **Smoke met de browser**: registreer een account → pleeg een misdaad → was wit →
   neem 10 OMD op → open de explorer-link bij de transactie → stort terug.
2. **Geautomatiseerd**: draai de e2e-smoke tegen productie (fase 1+2-checks werken
   overal; fase 3+ vereist database-toegang en is voor lokaal):

   ```bash
   BASE_URL="https://jouw-app.vercel.app" bash web/scripts/e2e.sh
   ```

3. **PWA**: Chrome DevTools → Lighthouse → check "installable"; voeg de app toe aan je
   homescherm op een telefoon.
4. **Contract-sanity**: `smoke.ts` uit stap 4, en controleer op sonicscan dat
   `OmertaToken.totalSupply` beweegt met opnames/stortingen.

---

## Stap 8 — Beheer & operaties

### Seizoenswissel (handmatig of cron)

```bash
curl -X POST -H "x-admin-secret: $ADMIN_SECRET" https://jouw-app/api/season/end
```

Automatiseer met een scheduled GitHub Action of cron-job.org (bijv. maandelijks).
De rollover bevriest de top 3, mint soulbound trofeeën, reset reputaties en opent het
volgende seizoen — idempotent beveiligd, dubbel aanroepen kan geen kwaad.

### Back-ups
- **Database**: dagelijkse dump (Neon heeft point-in-time recovery in de gratis tier).
  De DB bevat de versleutelde custodial keys — een verloren DB = verloren wallets.
- **Secrets**: `WALLET_ENC_KEY` + `TREASURY_PRIVATE_KEY` veilig en apart bewaren.
  Zonder `WALLET_ENC_KEY` is een database-backup waardeloos voor de wallets.

### Monitoring
- Vercel: Functions-logs voor `chain_error`-meldingen (mislukte mints/escrows worden
  altijd gelogd en het spelersaldo wordt teruggezet).
- Treasury-gas: alert (of wekelijkse check) op het S-saldo van de treasury op sonicscan.

### Incident-runbook
| Symptoom | Oorzaak | Actie |
|---|---|---|
| Bank geeft overal `chain_error` | RPC down of treasury zonder gas | check sonicscan-saldo, faucet bijvullen; spel blijft speelbaar |
| `chain_disabled` na deploy | `CHAIN_ENABLED` niet op `true` | env var zetten + redeploy |
| Withdraw werkt, deposit niet | speler-wallet zonder gas en top-up faalt | treasury-gas check (top-ups komen daarvandaan) |
| Unique constraint op `tokenId`/`onchainId` | chain gereset onder een bestaande DB | alleen dev; zie cleanup in `scripts/e2e.sh` |

### Sleutelrotatie
- `SESSION_SECRET`/`ADMIN_SECRET`: gewoon vervangen + redeploy.
- `TREASURY_PRIVATE_KEY`: nieuwe key genereren, dan met de **oude admin-key**
  `grantRole(MINTER_ROLE, nieuw)` op OmertaToken/OmertaItems/SeasonTrophy; let op:
  Bounty/Testament hebben een immutable attestor — die vereisen een redeploy.
- `WALLET_ENC_KEY`: alleen met een migratiescript dat alle `walletKeyEnc`-velden
  ontsleutelt en opnieuw versleutelt.

---

## Beveiligingschecklist vóór livegang

- [ ] Alle vijf secrets vers gegenereerd (geen dev-defaults uit `.env.example`)
- [ ] `.env` staat niet in git (check: `git ls-files | grep -c "\.env$"` → 0)
- [ ] Testspelers verwijderd of voorzien van sterke wachtwoorden
- [ ] HTTPS afgedwongen (Vercel: automatisch; VPS: reverse proxy)
- [ ] Database alleen bereikbaar vanaf de app (Neon: standaard; VPS: geen 5432 open)
- [ ] Treasury-saldo gemonitord; faucet-bookmark klaar
- [ ] `npx hardhat test` (17) en `npm test` in `web/` (64) groen op de deploy-commit
- [ ] Database-backup + herstelprocedure één keer geoefend
