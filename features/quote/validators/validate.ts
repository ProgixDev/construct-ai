// Deterministic post-extraction cleanup. Runs after the LLM returns
// valid-shaped JSON but before the pipeline surfaces the quote to the UI.
// Catches hallucinations, physical impossibilities, and duplicates the
// model missed. Every correction is logged so the estimator can audit
// what the pipeline changed.
//
// Pure module — no I/O, no provider calls. Easy to unit-test and safe to
// run on every extraction regardless of source.

import type { ExtractedItem, ExtractedQuote, QuoteValidation, Unit, ValidationIssue } from '../types'

// ---------- Domain rules ----------

// Closed category whitelist. Mirrors the extraction system prompt — TCE mode
// (tous corps d'état). Anything outside this set gets snapped to DIVERS with
// a warning.
const CATEGORY_WHITELIST = new Set<string>([
  // Plomberie / CVC
  'ALIMENTATION EF/EC',
  'ÉVACUATION EU/EV',
  'SANITAIRES',
  'ROBINETTERIE',
  'CHAUFFAGE',
  'PRODUCTION ECS',
  'VENTILATION',
  'CALORIFUGEAGE',
  'RACCORDEMENTS',
  // Électricité
  'ÉLECTRICITÉ CFO',
  'ÉLECTRICITÉ CFA',
  'ÉCLAIRAGE',
  'PHOTOVOLTAÏQUE',
  // Structure & enveloppe
  'GROS ŒUVRE',
  'MAÇONNERIE',
  'CHARPENTE/COUVERTURE',
  'ÉTANCHÉITÉ',
  // Second œuvre
  'MENUISERIE EXT.',
  'MENUISERIE INT.',
  'SERRURERIE/MÉTALLERIE',
  'CLOISONS/DOUBLAGES',
  'FAUX-PLAFONDS',
  'ISOLATION',
  // Finitions
  'CARRELAGE/FAÏENCE',
  'REVÊTEMENTS SOLS',
  'REVÊTEMENTS MURAUX',
  'PEINTURE',
  // Extérieur & spéciaux
  'VRD',
  'ESPACES VERTS',
  'ASCENSEURS',
  'SÉCURITÉ INCENDIE/SSI',
  'DÉSENFUMAGE',
  // Transverse
  "MAIN D'ŒUVRE",
  'DIVERS',
])

// Plausible units per category. Used for soft-warning — we keep the line
// but flip uncertain=true. Categories outside the whitelist fall through
// to DIVERS which accepts any unit.
const UNITS_BY_CATEGORY: Record<string, Set<Unit>> = {
  // Plomberie / CVC
  'ALIMENTATION EF/EC':    new Set<Unit>(['ml', 'u', 'ens', 'pce']),
  'ÉVACUATION EU/EV':      new Set<Unit>(['ml', 'u', 'ens', 'pce']),
  'SANITAIRES':            new Set<Unit>(['u', 'ens']),
  'ROBINETTERIE':          new Set<Unit>(['u', 'ens', 'pce']),
  'CHAUFFAGE':             new Set<Unit>(['u', 'ml', 'kg', 'ens', 'pce']),
  'PRODUCTION ECS':        new Set<Unit>(['u', 'ens']),
  'VENTILATION':           new Set<Unit>(['u', 'ml', 'm2', 'ens', 'pce']),
  'CALORIFUGEAGE':         new Set<Unit>(['ml', 'm2']),
  'RACCORDEMENTS':         new Set<Unit>(['u', 'ens']),
  // Électricité
  'ÉLECTRICITÉ CFO':       new Set<Unit>(['ml', 'u', 'ens', 'pce']),
  'ÉLECTRICITÉ CFA':       new Set<Unit>(['ml', 'u', 'ens', 'pce']),
  'ÉCLAIRAGE':             new Set<Unit>(['u', 'ml', 'ens', 'pce']),
  'PHOTOVOLTAÏQUE':        new Set<Unit>(['u', 'm2', 'ens']),
  // Structure & enveloppe
  'GROS ŒUVRE':            new Set<Unit>(['m3', 'm2', 'ml', 'kg', 'u', 'ens']),
  'MAÇONNERIE':            new Set<Unit>(['m2', 'm3', 'ml', 'kg', 'u']),
  'CHARPENTE/COUVERTURE':  new Set<Unit>(['m2', 'ml', 'u', 'm3']),
  'ÉTANCHÉITÉ':            new Set<Unit>(['m2', 'ml', 'u']),
  // Second œuvre
  'MENUISERIE EXT.':       new Set<Unit>(['u', 'm2', 'ml']),
  'MENUISERIE INT.':       new Set<Unit>(['u', 'm2', 'ml']),
  'SERRURERIE/MÉTALLERIE': new Set<Unit>(['u', 'ml', 'kg', 'm2']),
  'CLOISONS/DOUBLAGES':    new Set<Unit>(['m2', 'ml', 'u']),
  'FAUX-PLAFONDS':         new Set<Unit>(['m2', 'ml', 'u']),
  'ISOLATION':             new Set<Unit>(['m2', 'm3', 'ml']),
  // Finitions
  'CARRELAGE/FAÏENCE':     new Set<Unit>(['m2', 'ml', 'u']),
  'REVÊTEMENTS SOLS':      new Set<Unit>(['m2', 'ml']),
  'REVÊTEMENTS MURAUX':    new Set<Unit>(['m2', 'ml']),
  'PEINTURE':              new Set<Unit>(['m2', 'ml', 'u']),
  // Extérieur & spéciaux
  'VRD':                   new Set<Unit>(['m2', 'm3', 'ml', 'u', 'kg']),
  'ESPACES VERTS':         new Set<Unit>(['m2', 'u', 'ml']),
  'ASCENSEURS':            new Set<Unit>(['u', 'ens']),
  'SÉCURITÉ INCENDIE/SSI': new Set<Unit>(['u', 'ml', 'ens']),
  'DÉSENFUMAGE':           new Set<Unit>(['u', 'm2', 'ml', 'ens']),
  // Transverse
  "MAIN D'ŒUVRE":          new Set<Unit>(['h', 'ens']),
}

// Hard per-unit ceilings. A CCTP line requesting 10 000 ml of anything
// is almost certainly an LLM slip (wrong unit, decimal error, or stray
// zeroes). We keep the line but flip uncertain=true.
const HARD_MAX_BY_UNIT: Record<Unit, number> = {
  ml:  5000,
  m2:  2000,
  m3:  500,
  u:   500,
  kg:  10000,
  h:   2000,
  ens: 100,
  pce: 1000,
}

// Vague / catch-all patterns that break a devis conforme: a construction
// engineer cannot audit "Fournitures diverses" or "Petits matériels" line
// by line, so these are removed outright (Stage 1). Match on the
// normalized name so accents and punctuation don't sneak them through.
const VAGUE_NAME_PATTERNS: RegExp[] = [
  /\bfourniture[s]?\s+divers/,
  /\bfourniture[s]?\s+plomberie\b/,
  /\bmateriel[s]?\s+divers/,
  /\bpetit[s]?\s+materiel/,
  /\bpetite\s+quincaillerie/,
  /\baccessoire[s]?\s+divers/,
  /\bconsommable[s]?\b/,
  /\bdivers\s+plomberie\b/,
  /\bdivers\s+sanitaire[s]?\b/,
  /^divers$/,
  /^fournitures?$/,
]

// MAIN D'ŒUVRE lines whose name is essentially "Main d'œuvre" with no
// task breakdown. A conforme devis requires per-task labour lines.
const LUMP_SUM_LABOR_PATTERNS: RegExp[] = [
  /^main\s*d.?\s*oeuvre$/,
  /^pose\s+plomberie$/,
  /^pose\s+sanitaire[s]?$/,
  /^installation\s+complete$/,
  /^installation\s+plomberie$/,
]

// Categories whose designations must contain a dimension marker (Ø, DN,
// mm, mm², or a "NNxNN" size). Extraction prompt already asks for it —
// this catches the lines where the model slipped.
const DIM_REQUIRED_CATEGORIES = new Set<string>([
  'ALIMENTATION EF/EC',
  'ÉVACUATION EU/EV',
  'CALORIFUGEAGE',
  'ÉLECTRICITÉ CFO',
  'ÉLECTRICITÉ CFA',
])
const DIM_MARKER_RE = /(ø|Ø|\bdn\s*\d|\b\d{1,3}\s*mm[²2]?\b|\b\d{1,3}\s*\/\s*\d{1,3}\b|\b\d{1,3}\s*x\s*\d{1,3}\b|\b\d{1,3}\s*g\s*\d(?:[\.,]\d)?\b)/i

// ---------- Helpers ----------

function truncate(s: string, n = 60): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

function summarize(item: ExtractedItem): string {
  return `${item.name} · ${item.quantity} ${item.unit}`
}

// Normalize a name for dupe detection. We keep diameters (Ø12/14) because
// those are the whole point of not-merging in the first place.
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')       // strip accents
    .replace(/[^\p{L}\p{N}øØ/\-.]/gu, ' ') // keep letters, numbers, Ø, /, -, .
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeCategory(category: string): string {
  return category
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// Group key = category + unit + normalized name. Merging is intentionally
// strict — never across categories or units, because those would merge
// genuinely different SKUs.
function mergeKey(item: ExtractedItem): string {
  return `${item.category}|${item.unit}|${normalizeName(item.name)}`
}

// ---------- Main entry point ----------

export function validateQuote(quote: ExtractedQuote): {
  quote: ExtractedQuote
  validation: QuoteValidation
} {
  const removed: ValidationIssue[]  = []
  const warnings: ValidationIssue[] = []
  const merged: ValidationIssue[]   = []

  // Stage 1 — drop broken lines.
  const survivors: ExtractedItem[] = []
  for (const item of quote.items) {
    const reason = findHardFailure(item)
    if (reason) {
      removed.push({ item: truncate(summarize(item)), reason })
      continue
    }
    survivors.push({ ...item })
  }

  // Stage 2 — snap unknown categories to DIVERS.
  for (const item of survivors) {
    if (!CATEGORY_WHITELIST.has(item.category)) {
      warnings.push({
        item: truncate(summarize(item)),
        reason: `Catégorie hors référentiel « ${truncate(item.category, 40)} » → rebasculée en DIVERS.`,
      })
      item.category = 'DIVERS'
      item.uncertain = true
    }
  }

  // Stage 3 — soft flags on implausible unit/category or over-the-top qty.
  for (const item of survivors) {
    const allowed = UNITS_BY_CATEGORY[item.category]
    if (allowed && !allowed.has(item.unit)) {
      warnings.push({
        item: truncate(summarize(item)),
        reason: `Unité « ${item.unit} » inhabituelle pour ${item.category}. À vérifier.`,
      })
      item.uncertain = true
    }
    if (item.quantity > HARD_MAX_BY_UNIT[item.unit]) {
      warnings.push({
        item: truncate(summarize(item)),
        reason: `Quantité ${item.quantity} ${item.unit} dépasse le plafond usuel (${HARD_MAX_BY_UNIT[item.unit]}). À confirmer.`,
      })
      item.uncertain = true
    }
    if (!item.uncertain && (!item.reference || item.reference.trim() === '')) {
      warnings.push({
        item: truncate(summarize(item)),
        reason: 'Quantité donnée comme certaine mais aucune référence CCTP citée.',
      })
      item.uncertain = true
    }
    // Missing-specs: tubes/raccords/calorifuge must carry a dimension marker.
    if (DIM_REQUIRED_CATEGORIES.has(item.category) && !DIM_MARKER_RE.test(item.name)) {
      warnings.push({
        item: truncate(summarize(item)),
        reason: `Désignation sans diamètre ni dimension (Ø / DN / mm) — devis non conforme sur ${item.category}.`,
      })
      item.uncertain = true
    }
  }

  // Stage 3b — single-line MOE sanity check. If there's exactly one
  // MAIN D'ŒUVRE line surviving, flag it: a conforme devis needs the
  // labour broken down by task.
  const moeLines = survivors.filter(i => normalizeCategory(i.category) === "MAIN D'OEUVRE")
  if (moeLines.length === 1) {
    warnings.push({
      item: truncate(summarize(moeLines[0])),
      reason: 'Une seule ligne de main d\u2019œuvre — devis non conforme, à ventiler par tâche (pose chaudière, pose radiateurs, raccordements…).',
    })
    moeLines[0].uncertain = true
  }

  // Stage 4 — merge exact duplicates (same category + unit + normalized name).
  // Strategy: sum quantities, keep the more-certain version of each field,
  // prefer a non-empty reference over an empty one.
  const byKey = new Map<string, { item: ExtractedItem; count: number }>()
  for (const item of survivors) {
    const key = mergeKey(item)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, { item, count: 1 })
      continue
    }
    existing.item.quantity += item.quantity
    if (!existing.item.reference && item.reference) existing.item.reference = item.reference
    if (!existing.item.description && item.description) existing.item.description = item.description
    existing.item.uncertain = existing.item.uncertain || item.uncertain
    existing.count += 1
  }

  const deduped: ExtractedItem[] = []
  for (const { item, count } of byKey.values()) {
    if (count > 1) {
      merged.push({
        item: truncate(summarize(item)),
        reason: `${count} lignes identiques fusionnées · quantité totale ${item.quantity} ${item.unit}.`,
      })
    }
    deduped.push(item)
  }

  // Stage 5 — surface the corrections in the quote's notes as well, so
  // they show up in the PDF export and not only in a dev-tools payload.
  const summaryNotes = buildSummaryNotes({ removed, warnings, merged })

  return {
    quote: {
      ...quote,
      items: deduped,
      notes: [...quote.notes, ...summaryNotes],
    },
    validation: { removed, warnings, merged },
  }
}

// ---------- Hard-failure check ----------

function findHardFailure(item: ExtractedItem): string | null {
  if (!item.name || item.name.trim() === '') {
    return 'Nom vide — ligne ignorée.'
  }
  if (!item.category || item.category.trim() === '') {
    return 'Catégorie vide — ligne ignorée.'
  }
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    return `Quantité invalide (${item.quantity}) — ligne ignorée.`
  }

  const normalized = normalizeName(item.name)

  // Vague catch-all names break devis conformance (non-auditable).
  for (const pat of VAGUE_NAME_PATTERNS) {
    if (pat.test(normalized)) {
      return 'Ligne vague non-conforme (« fournitures diverses », « petits matériels », …) — à détailler en postes concrets.'
    }
  }

  // Lump-sum labour: a single global MOE line, or labour billed in ens/lot.
  if (normalizeCategory(item.category) === "MAIN D'OEUVRE") {
    if (item.unit === 'ens') {
      return 'Main d\u2019œuvre en forfait (unit « ens ») — devis non conforme, détailler en heures par tâche.'
    }
    for (const pat of LUMP_SUM_LABOR_PATTERNS) {
      if (pat.test(normalized)) {
        return 'Ligne « main d\u2019œuvre » globale sans détail de tâche — devis non conforme.'
      }
    }
  }

  return null
}

// ---------- Notes summary ----------

function buildSummaryNotes(v: QuoteValidation): string[] {
  const notes: string[] = []
  if (v.removed.length > 0) {
    notes.push(`Validation : ${v.removed.length} ligne(s) supprimée(s) pour valeurs invalides.`)
  }
  if (v.merged.length > 0) {
    notes.push(`Validation : ${v.merged.length} doublon(s) fusionné(s).`)
  }
  if (v.warnings.length > 0) {
    notes.push(`Validation : ${v.warnings.length} avertissement(s) — quantités marquées incertaines.`)
  }
  return notes
}

// Useful for callers that want to know whether anything changed without
// inspecting the full validation object.
export function hasCorrections(v: QuoteValidation): boolean {
  return v.removed.length > 0 || v.warnings.length > 0 || v.merged.length > 0
}
