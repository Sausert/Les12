# Sonic Omerta 🕴️

Een mobiele maffia-MMO in de stijl van [barafranca.nl](https://barafranca.nl) (Omerta), met een
economie op de **Sonic blockchain**. Misdaden plegen, rangen klimmen, zwart geld witwassen en je
vermogen als **OMD-token** (Omerta Dollar, ERC-20) naar je eigen wallet halen.

> ⚠️ Dit is een leerproject voor het **Sonic Blaze testnet** — er gaat geen echt geld in om.

## Architectuur

**De database is de bron van waarheid voor gameplay; de chain alleen voor opgenomen tokens.**
Alle spelacties (misdaden, witwassen) zijn server-authoritative en gratis/instant in Postgres.
De chain wordt alleen geraakt bij opnemen (mint naar je wallet) en storten (burn via de Bank).

```
Les12/
├── contracts/        Hardhat + Solidity (OmertaToken ERC-20, Bank, Bounty-escrow)
├── web/              Next.js 16 PWA (App Router, Tailwind v4, Prisma, viem)
└── docker-compose.yml  PostgreSQL 16
```

### Speelbare kern (fase 0 + 1 — dit is gebouwd)

- **Account + custodial wallet**: registreren met bijnaam/wachtwoord; de server genereert per
  speler een Sonic-keypair (privkey AES-256-GCM versleuteld in de DB)
- **8 misdaden, 16 rangen** (Lege Huls → Godfather), cooldowns, XP, automatische promotie
- **Heat & zwart geld**: misdaadbuit is *dirty cash* en verhoogt je heat (hogere faalkans);
  witwassen bij de bank (15% fee) maakt het schoon en koelt je af
- **Bank ⇄ blockchain**: schoon geld opnemen = OMD minten naar je wallet; storten = OMD
  burnen via het Bank-contract; transactiehistorie met explorer-links
- **Ranglijst** op XP en vermogen
- **PWA**: installeerbaar, mobile-first, film-noir stijl (dossier-kaarten, stempel-animaties,
  heat-gloed, krantenkop bij promotie)
- **i18n**: Nederlands + Engels, per speler instelbaar

### PvP & kills (fase 2 — dit is gebouwd)

- **Opsporen & liquideren**: spoor een speler op (cooldown), koop kogels (cash sink) en vuur;
  benodigde kogels schalen met de rang van het doelwit
- **Bloedgeld**: een geslaagde moord levert 60% van het vermogen van het slachtoffer op
  (als zwart geld); het slachtoffer houdt 40%
- **Bescherming**: huur bodyguards (24u) die het aantal benodigde kogels verdubbelen
- **On-chain premiejacht**: zet een premie op iemands hoofd — het bedrag wordt als OMD
  gelockt in het `Bounty`-escrowcontract; bij een bevestigde moord tekent de server een
  **EIP-712 kill-attest** en wordt de pot on-chain uitbetaald aan de killer
- **Gevangenis**: mislukte misdaden bij hoge heat → de cel; koop de corrupte agent om,
  of laat een medespeler een uitbraak wagen (risico: zelf de cel in)
- **Dood & getuigenbescherming**: na je dood kies je — opnieuw onderaan beginnen, of tegen
  betaling een nieuwe identiteit met 75% van je XP (open premies op je oude naam vervallen)
- **De Stadskrant**: kill feed en arrestaties als krantenkoppen

### Families & territorium (fase 3 — dit is gebouwd)

- **Families**: oprichten (rang Picciotto + 1000 OMD als startkapitaal voor de kas),
  uitnodigingen, rollen (Don / Onderbaas / Soldaat), promoveren/verbannen, gedeelde kas
  waaruit alleen de leiding kan opnemen
- **Territoriumcontrole**: zes stadswijken; families claimen niemandsland (2000 OMD uit de
  kas) en heffen 5% **protectiegeld** op elke misdaad die buitenstaanders in hun wijk plegen
- **Turf wars**: val de wijk van een andere familie aan (1000 OMD); na 5 minuten valt de
  beslissing op basis van de gezamenlijke rangsterkte van beide families — de verdediger
  heeft thuisvoordeel
- **Coöp-overvallen**: drie-mans heists (Chauffeur / Kluiskraker / Uitkijk) — treinroof,
  casinokluis of geldwagen; slagingskans stijgt met de rangen van de crew, buit voor ieder
- **Verraad & omertà**: praat anoniem met de politie — de inval kost de familiekas 20% en
  jij vangt de helft, maar bij ontmaskering lig je eruit en staat de hele stad tegen je

Latere fasen (casino & smokkel, NFT-bezittingen, seizoenen) staan
beschreven in het projectplan en bouwen additief op dit schema voort.

## Snel starten (lokaal)

Vereist: Node 22+, PostgreSQL (of Docker).

```bash
# 1. Database
docker compose up -d          # of een lokale postgres met user/db "omerta"

# 2. Web-app
cd web
cp .env.example .env
npm install
npx prisma migrate dev        # schema + migraties
npx prisma db seed            # misdaden, rangen, 2 testspelers
npm run dev                   # http://localhost:3000
```

Inloggen kan met testspeler `DonTesto` / `hush-hush-1930`, of registreer een eigen account.

Zonder blockchain (`CHAIN_ENABLED=false`, de default) werkt het hele spel; alleen
opnemen/storten bij de bank vereist een chain.

## Blockchain aanzetten

### Optie A — lokale Hardhat-node (geen internet nodig)

```bash
cd contracts
npm install
npx hardhat test                                  # 6 contracttests
npx hardhat node                                  # terminal 1
npx hardhat run scripts/deploy.ts --network localhost   # terminal 2
```

De deploy schrijft de adressen naar `web/src/lib/chain/deployments.json`.
Zet daarna in `web/.env`:

```
CHAIN_ENABLED="true"
CHAIN_RPC_URL="http://127.0.0.1:8545"
CHAIN_ID="31337"
TREASURY_PRIVATE_KEY="<hardhat account #0 key, zie .env.example>"
```

Herstart de app (bij `npm start` ook eerst opnieuw `npm run build`).

### Optie B — Sonic Blaze testnet

1. Maak een treasury-keypair en vraag native **S** (gas) aan via de
   [Sonic faucet](https://testnet.soniclabs.com)
2. Deploy:
   ```bash
   cd contracts
   TREASURY_PRIVATE_KEY=0x... npx hardhat run scripts/deploy.ts --network sonicBlaze
   ```
3. In `web/.env`: `CHAIN_ENABLED="true"`, `CHAIN_RPC_URL="https://rpc.blaze.soniclabs.com"`,
   `CHAIN_ID="57054"` en dezelfde `TREASURY_PRIVATE_KEY`
4. Withdraw-transacties zijn nu zichtbaar op [testnet.sonicscan.org](https://testnet.sonicscan.org)

## Testen

```bash
cd contracts && npx hardhat test     # smart contracts (rollen, faucet, deposit/burn)
cd web && npm test                   # pure spellogica (rangen, misdaden, witwassen)
cd web && npm run lint               # ESLint
cd web && bash scripts/e2e.sh        # end-to-end: registreren → misdaad → cooldown →
                                     # witwassen → withdraw (mint) → deposit (burn)
```

Het e2e-script vereist een draaiende app + database; met `CHAIN_ENABLED=true` en een
draaiende chain test het ook de volledige on-chain flow.

## Beveiligingsmodel (bewuste keuzes voor een testnet-leerproject)

- **Custodial wallets**: privkeys staan AES-256-GCM-versleuteld in de DB. Niet geschikt voor
  mainnet — de seam in `web/src/lib/chain/wallet.ts` maakt een latere overstap naar bijv.
  Privy of WalletConnect mogelijk zonder de rest van de code te raken.
- **Anti-cheat**: de client stuurt alleen intenties; alle rolls, payouts en cooldowns worden
  server-side bepaald en atomair afgedwongen in Postgres-transacties.
- **Economie-brug**: off-chain saldo wordt altijd éérst gedebiteerd (in dezelfde transactie)
  voordat er gemint wordt; crediteren gebeurt alleen na een bevestigde receipt.
