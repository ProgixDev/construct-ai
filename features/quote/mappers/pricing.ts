// Convert an AI-extracted quote into the `Row[]` shape used by /quote,
// attaching a unit price from the selected supplier.
//
// The supplier catalog currently has only 5 reference prices
// (PER, PVC, WC/sanitaire, chaudière, VMC). We bucket each extracted
// item into one of those categories via keyword matching.

import type { ExtractedItem } from '../types'
import type { Supplier } from '@/features/catalog/suppliers'

type Bucket = 0 | 1 | 2 | 3 | 4

type Visual = {
  icon: string
  iconBg: string
  iconColor: string
  catColor: string
}

const BUCKET_KEYWORDS: { bucket: Bucket; patterns: RegExp[] }[] = [
  { bucket: 0, patterns: [/\bPER\b/i, /\bcuivre\b/i, /\balimentation\b/i, /\bEF\b/i, /\bEC\b/i, /\bECS\b/i, /\bmultic/i] },
  { bucket: 1, patterns: [/\bPVC\b/i, /évacuation/i, /\bchute\b/i, /\bEU\b/i, /\bEV\b/i, /siphon/i] },
  { bucket: 2, patterns: [/\bWC\b/i, /lavabo/i, /baignoire/i, /douche/i, /évier/i, /sanitaire/i, /mitigeur/i, /robinet/i] },
  { bucket: 3, patterns: [/chaudière/i, /radiateur/i, /chauffage/i, /\bgaz\b/i, /thermostat/i, /pompe à chaleur/i, /PAC/] },
  { bucket: 4, patterns: [/\bVMC\b/i, /ventilation/i, /bouche/i, /extracteur/i, /hygro/i, /caisson/i] },
]

const CATEGORY_VISUALS: { match: RegExp; v: Visual }[] = [
  { match: /aliment|EF|EC|ECS|PER|cuivre/i, v: { icon: 'water',                 iconBg: 'bg-primary/10',     iconColor: 'text-primary',      catColor: 'text-primary' } },
  { match: /évacuation|PVC|chute|EU|EV/i,    v: { icon: 'valve',                 iconBg: 'bg-cyan-500/10',    iconColor: 'text-cyan-400',     catColor: 'text-cyan-400' } },
  { match: /sanitaire|WC|baignoire|douche/i, v: { icon: 'bathroom',              iconBg: 'bg-secondary/10',   iconColor: 'text-secondary',    catColor: 'text-secondary' } },
  { match: /chauff|gaz|radiateur|PAC/i,      v: { icon: 'local_fire_department', iconBg: 'bg-tertiary/10',    iconColor: 'text-tertiary',     catColor: 'text-tertiary' } },
  { match: /VMC|ventilation|hygro/i,         v: { icon: 'air',                   iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-400',  catColor: 'text-emerald-400' } },
  { match: /main.?d.?œuvre|MO|chantier/i,    v: { icon: 'engineering',           iconBg: 'bg-white/5',        iconColor: 'text-on-surface',   catColor: 'text-on-surface' } },
]

const DEFAULT_VISUAL: Visual = { icon: 'build', iconBg: 'bg-white/5', iconColor: 'text-on-surface-variant', catColor: 'text-on-surface' }

// Returns the bucket the item matches, or null when no plumbing keyword fits.
// Non-plumbing items (éclairage, gros œuvre, peinture, etc.) must NOT inherit
// the PER bucket — better to surface a 0€ that the estimator fills in than a
// bogus 16€/u default that looks like it was actually priced.
function bucketFor(item: ExtractedItem): Bucket | null {
  const haystack = `${item.category} ${item.name} ${item.description ?? ''}`
  for (const { bucket, patterns } of BUCKET_KEYWORDS) {
    if (patterns.some(p => p.test(haystack))) return bucket
  }
  return null
}

export function visualForCategory(category: string): Visual {
  return CATEGORY_VISUALS.find(c => c.match.test(category))?.v ?? DEFAULT_VISUAL
}

/**
 * Unit price for an extracted item given a supplier's 5-bucket catalog.
 * Rough heuristic: use the bucket's anchor price, then scale for sub-types
 * (linear metre vs unit, diameters, etc.) by a simple factor table.
 */
export function unitPriceFor(item: ExtractedItem, prices: Supplier['prices']): number {
  // Labour gets a deterministic hourly rate regardless of bucket match.
  if (item.unit === 'h') return Math.max(45, prices[2] * 0.12)

  const b = bucketFor(item)
  // No plumbing bucket match → leave the price empty (0 €). The estimator
  // will fill it in manually for non-plumbing trades (éclairage, gros œuvre,
  // peinture, etc.) or once a real catalog connector returns a price.
  if (b === null) return 0
  const base = prices[b]

  // Scale based on unit: linear-metre items are priced at their catalog value,
  // unit items (u, ens, pce) use the catalog value directly.
  const name = item.name.toLowerCase()
  if (item.unit === 'kg')  return base * 0.08
  if (item.unit === 'm2')  return base * 0.6
  if (item.unit === 'm3')  return base * 1.2

  // Inside a bucket, cheap vs expensive variants:
  if (b === 2) { // sanitaire
    if (name.includes('baignoire')) return base * 1.4
    if (name.includes('douche'))    return base * 1.15
    if (name.includes('évier'))     return base * 0.85
    if (name.includes('lavabo'))    return base * 0.6
  }
  if (b === 3) { // chauffage
    if (name.includes('radiateur'))     return base * 0.10
    if (name.includes('thermostat'))    return base * 0.08
    if (name.includes('pompe'))         return base * 1.8
  }

  return base
}

export type QuoteRow = {
  idx: number
  icon: string
  iconBg: string
  iconColor: string
  name: string
  sub: string
  qtyNum: number
  qtyUnit: string
  unitNum: number
  category: string
  uncertain?: boolean
}

export function itemsToRows(items: ExtractedItem[], prices: Supplier['prices']): QuoteRow[] {
  return items.map((it, idx) => {
    const v = visualForCategory(it.category)
    return {
      idx,
      icon: v.icon,
      iconBg: v.iconBg,
      iconColor: v.iconColor,
      name: it.name,
      sub: it.description || it.reference || '',
      qtyNum: it.quantity,
      qtyUnit: it.unit,
      unitNum: unitPriceFor(it, prices),
      category: it.category,
      uncertain: it.uncertain,
    }
  })
}
