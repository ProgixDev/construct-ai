# Setup — Plombia Chiffrage (construct-ai)

Application pour chiffrage automatique de CCTP plomberie : auth Supabase, extraction IA, paiement Stripe, essai gratuit.

## Pré-requis

| Outil | Pourquoi | Comment installer |
|---|---|---|
| Node 18+ | runtime Next.js | https://nodejs.org |
| Supabase CLI | DB + auth en local | `npm i -g supabase` puis `scoop install supabase` sur Windows |
| Compte Stripe (test mode) | paiements | https://dashboard.stripe.com (gratuit) |
| Clé OpenAI | extraction IA | https://platform.openai.com/api-keys |

## Setup en 5 étapes

### 1. Dépendances

```bash
cd construct-ai
npm install        # ou bun install (bun.lock présent)
```

### 2. Démarrer Supabase en local

```bash
supabase start
```

Le CLI affiche à la fin :
```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
anon key: eyJhbGciOiJI...
service_role key: eyJhbGciOiJI...
```

### 3. Configurer `.env.local`

```bash
cp .env.example .env.local
```

Remplis :
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` ← depuis l'étape 2
- `OPENAI_API_KEY` ← ta clé OpenAI

### 4. Migrations DB

```bash
npm run db:push      # applique les migrations Supabase
# OU
supabase migration up
```

### 5. Lancer l'app

```bash
npm run dev
```

→ http://localhost:3000

## Activer Stripe (paiements réels)

L'app marche **sans Stripe** : le PaywallModal active le plan en localStorage. Pour avoir de vrais paiements :

### A. Côté Stripe Dashboard

1. Mode test : https://dashboard.stripe.com/test/products → **+ Add product**
   - **Pro** — récurrent — 49 € / mois
   - **Team** — récurrent — 129 € / mois
   - (Enterprise reste en "sur devis", pas de produit Stripe)
2. Note les `price_xxx` de chaque produit
3. **Developers → API keys** : copie la *Secret key* (`sk_test_...`) et la *Publishable key* (`pk_test_...`)
4. **Developers → Webhooks → Add endpoint** :
   - URL : `http://localhost:3000/api/billing/webhook` (en dev avec Stripe CLI) ou `https://tondomaine.com/api/billing/webhook` (prod)
   - Events à écouter : `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Note le `whsec_...`

### B. Côté `.env.local`

Remplis la section `# ----- Stripe -----`.

### C. Stripe CLI (recommandé en dev pour les webhooks)

```bash
stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
```

## Test du flow complet

1. http://localhost:3000 → cliquer "Se connecter" → créer un compte
2. Confirme l'email (regarde la boîte de réception, ou Studio Supabase si en local: http://127.0.0.1:54323)
3. /projects → upload un PDF de CCTP → extraction
4. /quote → tu vois ton chiffrage, modifie, télécharge le PDF
5. Quand le quota d'essai (1 quote) est dépassé → PaywallModal s'ouvre
6. Choisis Pro → redirigé sur Stripe Checkout → carte test `4242 4242 4242 4242`
7. Retour sur l'app → plan = Pro, quotas illimités

## Architecture

```
app/
├── (public)/          Landing, auth, onboarding
├── (workspace)/       Espace utilisateur connecté (dashboard, projects, quote, settings...)
└── api/
    ├── extract/       POST PDF → JSON chiffrage
    ├── me/            GET utilisateur courant
    └── billing/       Stripe (checkout, portal, webhook)

features/
├── auth/              AuthProvider + helpers Supabase
├── subscription/      Store trial/plans + PaywallModal
├── quote/             Édition + génération PDF du chiffrage
└── catalog/           Comptes fournisseurs + matching

server/
├── core/auth/         requireUser() server-side
└── services/
    ├── extraction/    Pipeline TOC → extraction (3 providers)
    └── billing/       Stripe service (NEW)
```

## Troubleshooting

| Erreur | Solution |
|---|---|
| `Missing NEXT_PUBLIC_SUPABASE_URL` au démarrage | `.env.local` manquant ou mal chargé — redémarre `npm run dev` |
| Auth signup bloque sur "Vérifiez votre email" | Avec Supabase local : `supabase status` → URL Inbucket http://127.0.0.1:54324, regarde les mails |
| `OpenAI 429 rate_limit` sur gros CCTP | Tier 1 limité à 30K TPM. Passe en gpt-4o-mini (`EXTRACTION_PROVIDER=openai` + override model dans la requête) |
| Stripe webhook ne reçoit rien en dev | Lance `stripe listen --forward-to localhost:3000/api/billing/webhook` |
