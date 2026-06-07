// Match engine for CCTP item -> catalog entry.
//
// Layers:
//   1. exact distributor reference
//   2. exact normalized label
//   3. fuzzy trigram search, first within the guessed family, then across the
//      full catalog if the family guess looks wrong
//   4. public tariff fallback

import type { ExtractedItem } from '@/features/quote/types'
import { familyFor, extractDiameterMm, normalize, type CatalogEntry, type Family, type MatchResult } from '../types'

const TRIGRAM_THRESHOLD = 0.55

function trigrams(s: string): Set<string> {
  const norm = ` ${s} `
  const set = new Set<string>()
  for (let i = 0; i < norm.length - 2; i++) set.add(norm.slice(i, i + 3))
  return set
}

function diceCoef(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter += 1
  return (2 * inter) / (a.size + b.size)
}

export type MatchContext = {
  entries: CatalogEntry[]
  discountByFamily: Record<Family, number>
  publicTariffFallback: (item: ExtractedItem) => number
}

function bestFuzzyMatch(entries: CatalogEntry[], query: string, diameter?: number): { entry: CatalogEntry; score: number } | null {
  if (entries.length === 0) return null

  const queryGrams = trigrams(query)
  let best: { entry: CatalogEntry; score: number } | null = null

  for (const entry of entries) {
    let score = diceCoef(queryGrams, trigrams(entry.normalizedLabel))
    if (diameter && entry.diameterMm && diameter === entry.diameterMm) score += 0.15
    if (!best || score > best.score) best = { entry, score }
  }

  return best
}

export function matchItem(item: ExtractedItem, ctx: MatchContext): MatchResult {
  const fam = familyFor(`${item.category} ${item.name} ${item.description ?? ''}`)
  const normName = normalize(`${item.name} ${item.description ?? ''}`)
  const diameter = extractDiameterMm(`${item.name} ${item.description ?? ''}`)

  // 1) Exact distributor reference.
  if (item.reference) {
    const ref = item.reference.trim()
    const exact = ctx.entries.find(e => e.itemCode === ref)
    if (exact) return { entry: exact, method: 'exact_code', score: 1.0, unitPriceHT: exact.netPriceHT }
  }

  // 2) Exact normalized label.
  const familyEntries = ctx.entries.filter(e => e.family === fam)
  const exactLabel = familyEntries.find(e => e.normalizedLabel === normName)
  if (exactLabel) {
    return { entry: exactLabel, method: 'normalized_label', score: 0.98, unitPriceHT: exactLabel.netPriceHT }
  }

  // 3) Fuzzy search. Prefer the guessed family, but fall back to the whole
  // catalog when the family heuristic is clearly wrong or too narrow.
  const familyMatch = bestFuzzyMatch(familyEntries, normName, diameter)
  if (familyMatch && familyMatch.score >= TRIGRAM_THRESHOLD) {
    return {
      entry: familyMatch.entry,
      method: 'fuzzy_trigram',
      score: Math.min(familyMatch.score, 1),
      unitPriceHT: familyMatch.entry.netPriceHT,
    }
  }

  const globalMatch = bestFuzzyMatch(ctx.entries, normName, diameter)
  if (globalMatch && globalMatch.score >= TRIGRAM_THRESHOLD + 0.1) {
    return {
      entry: globalMatch.entry,
      method: 'fuzzy_trigram',
      score: Math.min(globalMatch.score, 1),
      unitPriceHT: globalMatch.entry.netPriceHT,
    }
  }

  // 4) Fallback.
  const publicPrice = ctx.publicTariffFallback(item)
  const discountPct = ctx.discountByFamily[fam] ?? 0

  if (discountPct > 0) {
    return {
      entry: null,
      method: 'discount_fallback',
      score: 0.4,
      unitPriceHT: publicPrice * (1 - discountPct / 100),
    }
  }

  return {
    entry: null,
    method: 'public_fallback',
    score: 0.2,
    unitPriceHT: publicPrice,
  }
}

export function methodLabel(method: MatchResult['method']): string {
  switch (method) {
    case 'exact_code':        return 'Réf. exacte'
    case 'ean':               return 'Code EAN'
    case 'normalized_label':  return 'Libellé exact'
    case 'fuzzy_trigram':     return 'Libellé proche'
    case 'discount_fallback': return 'Remise famille'
    case 'public_fallback':   return 'Tarif public'
  }
}

export function methodTier(method: MatchResult['method']): 'high' | 'medium' | 'low' {
  if (method === 'exact_code' || method === 'ean' || method === 'normalized_label') return 'high'
  if (method === 'fuzzy_trigram' || method === 'discount_fallback') return 'medium'
  return 'low'
}
