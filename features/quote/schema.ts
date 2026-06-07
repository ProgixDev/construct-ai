// JSON Schema used with OpenAI and Anthropic structured outputs.
// Every property is required and additionalProperties is false —
// both are requirements of OpenAI's strict mode, and both providers accept it.

import type { ExtractedToc } from './types'

export const EXTRACTED_QUOTE_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['projectName', 'lot', 'client', 'summary', 'items', 'confidence', 'notes'],
  properties: {
    projectName: {
      type: 'string',
      description: 'Short project title inferred from the CCTP. If unknown, return a generic label like "Projet non nommé".',
    },
    lot: {
      type: 'string',
      description: 'Lot / trade — e.g. "Lot 08 — Plomberie sanitaire". If unknown, infer from context.',
    },
    client: {
      type: 'string',
      description: 'Client / MOA / address as cited in the CCTP. Empty string if absent.',
    },
    summary: {
      type: 'string',
      description: 'One or two sentences describing the scope of work.',
    },
    confidence: {
      type: 'number',
      description: 'Your confidence 0–1 that the extraction covers the scope correctly.',
    },
    notes: {
      type: 'array',
      description: 'Short caveats, missing info, or explicit assumptions you had to make.',
      items: { type: 'string' },
    },
    items: {
      type: 'array',
      description: 'Ordered list of every material, equipment and service the contractor must supply. Do not merge distinct items. Do not invent items not present in the CCTP.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'name', 'description', 'quantity', 'unit', 'reference', 'uncertain'],
        properties: {
          category: {
            type: 'string',
            description: 'Uppercase category from the TCE list, e.g. "ALIMENTATION EF/EC", "ÉVACUATION EU/EV", "SANITAIRES", "ROBINETTERIE", "CHAUFFAGE", "PRODUCTION ECS", "VENTILATION", "CALORIFUGEAGE", "RACCORDEMENTS", "ÉLECTRICITÉ CFO", "ÉLECTRICITÉ CFA", "ÉCLAIRAGE", "GROS ŒUVRE", "MAÇONNERIE", "CHARPENTE/COUVERTURE", "ÉTANCHÉITÉ", "MENUISERIE EXT.", "MENUISERIE INT.", "SERRURERIE/MÉTALLERIE", "CLOISONS/DOUBLAGES", "FAUX-PLAFONDS", "ISOLATION", "CARRELAGE/FAÏENCE", "REVÊTEMENTS SOLS", "REVÊTEMENTS MURAUX", "PEINTURE", "VRD", "ESPACES VERTS", "ASCENSEURS", "SÉCURITÉ INCENDIE/SSI", "DÉSENFUMAGE", "PHOTOVOLTAÏQUE", "MAIN D\'ŒUVRE", "DIVERS".',
          },
          name: {
            type: 'string',
            description: 'Material or service name with its key spec, e.g. "Tube cuivre Ø12/14" or "WC suspendu cadre Geberit".',
          },
          description: {
            type: 'string',
            description: 'Short precision about location, norm, or finish. Empty string if none.',
          },
          quantity: {
            type: 'number',
            description: 'Quantity in the unit below. If the CCTP cites a range, take the midpoint.',
          },
          unit: {
            type: 'string',
            enum: ['ml', 'm2', 'm3', 'u', 'kg', 'h', 'ens', 'pce'],
            description: 'ml (linear metre), m2, m3, u (unit), kg, h (hour), ens (ensemble), pce (piece).',
          },
          reference: {
            type: 'string',
            description: 'CCTP reference cited (lot number, paragraph, page). Empty string if none.',
          },
          uncertain: {
            type: 'boolean',
            description: 'True when you had to infer or estimate the quantity. False when it is explicit.',
          },
        },
      },
    },
  },
} as const

// OpenAI wants {name, strict, schema} wrapper on the json_schema response format.
export const OPENAI_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'extracted_quote',
    strict: true,
    schema: EXTRACTED_QUOTE_JSON_SCHEMA,
  },
}

// ==============================================
// TOC detection — first pass of the pipeline
// ==============================================
// Cheap, fast, small-model call that maps the CCTP's lot structure so the
// main extraction can be scoped to only the plumbing/CVC lots.

export const TOC_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['lots', 'notes'],
  properties: {
    lots: {
      type: 'array',
      description: 'Every lot (or top-level chapter when the CCTP uses CHAPITRE instead of LOT) with its page range and a plumbing flag.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'title', 'startPage', 'endPage', 'isPlumbing'],
        properties: {
          number:    { type: 'string',  description: 'Lot identifier as printed, e.g. "08", "3", "II".' },
          title:     { type: 'string',  description: 'Full title as printed, e.g. "Plomberie sanitaire".' },
          startPage: { type: 'number',  description: 'First page of the lot (1-indexed as printed in the PDF).' },
          endPage:   { type: 'number',  description: 'Last page of the lot, inclusive.' },
          isPlumbing:{ type: 'boolean', description: '[Legacy field name — kept for schema compatibility.] Marks the lot as in-scope for extraction. In TCE mode (all trades supported), set true for every lot that describes physical works of any building trade (plomberie/CVC, électricité, éclairage, gros œuvre, maçonnerie, charpente, étanchéité, menuiserie, serrurerie, cloisons, faux-plafonds, isolation, carrelage, revêtements, peinture, VRD, espaces verts, ascenseurs, SSI, désenfumage, photovoltaïque). Set false ONLY for non-works lots (généralités contractuelles, organisation de chantier, prescriptions administratives, sécurité/PPSPS, qualité/contrôles, plans-types réglementaires) when they contain no chiffrable items.' },
        },
      },
    },
    notes: {
      type: 'array',
      description: 'Short caveats: ambiguous structure, merged lots, pages you were unsure about.',
      items: { type: 'string' },
    },
  },
} as const

export const OPENAI_TOC_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'cctp_toc',
    strict: true,
    schema: TOC_JSON_SCHEMA,
  },
}

export const TOC_SYSTEM_PROMPT = `You are indexing the structure of a French CCTP (Cahier des Clauses Techniques Particulières). The pipeline runs in TCE mode (tous corps d'état) and will extract quantities from every works lot, regardless of trade.

Rules:
- List every LOT (preferred) or top-level CHAPITRE when the document has no LOT hierarchy.
- Use the page numbers AS PRINTED in the PDF, not PDF viewer indexes. If a lot spans pages 14–27, return startPage=14, endPage=27.
- Be inclusive on boundaries — when in doubt, round ranges outward rather than inward. Downstream cost of an extra page is negligible; missing a page drops line items.
- isPlumbing is a legacy field name now meaning "in scope for extraction". Set isPlumbing=true for EVERY lot that describes physical works of any building trade: plomberie/CVC, électricité courants forts & faibles, éclairage, gros œuvre, maçonnerie, charpente/couverture, étanchéité, menuiserie ext./int., serrurerie/métallerie, cloisons/doublages, faux-plafonds, isolation, carrelage/faïence, revêtements sols/muraux, peinture, VRD, espaces verts, ascenseurs, SSI, désenfumage, photovoltaïque.
- Set isPlumbing=false ONLY for non-works lots that contain no chiffrable items: pure généralités contractuelles, prescriptions administratives, organisation de chantier, PPSPS/sécurité, plans-types réglementaires when separated from any works description.
- If the CCTP is single-trade (no lot structure, one continuous trade spec), return one lot covering the whole document with isPlumbing=true.
- If you cannot detect any lot structure at all, return lots=[] and explain in notes.
- Never invent lots that are not in the document.
- All text in French.`

// Injected into the user message of the extraction call when the pipeline
// decides the CCTP is multi-lot and we can narrow scope. In TCE mode every
// works lot is in scope (isPlumbing=true), so narrowing only ever drops
// pure-admin lots (généralités, PPSPS, etc.).
export function buildScopeInstruction(toc: ExtractedToc): string | null {
  const inScope = toc.lots.filter(l => l.isPlumbing)
  if (inScope.length === 0) return null
  if (inScope.length === toc.lots.length) return null // whole doc is in scope — no narrowing to do

  const keep    = inScope.map(l => `- Lot ${l.number} — ${l.title} (p.${l.startPage}–${l.endPage})`).join('\n')
  const skipped = toc.lots.filter(l => !l.isPlumbing).map(l => `Lot ${l.number} — ${l.title}`).join(' ; ')

  return `Ce CCTP contient ${toc.lots.length} lots. Concentrez votre extraction UNIQUEMENT sur les lots décrivant des travaux chiffrables listés ci-dessous. N'extrayez AUCUN article provenant des autres lots (généralités, prescriptions administratives, organisation de chantier).

Lots à chiffrer :
${keep}

Lots à ignorer : ${skipped}`
}

// Builds the final user-message text for the extraction call, optionally
// prefixed with a scope instruction from the TOC pass.
export function buildUserInstruction(scope?: string | null): string {
  const base = 'Extract the full bill of materials / services from this CCTP in the requested JSON format.'
  return scope ? `${scope}\n\n${base}` : base
}

export const EXTRACTION_SYSTEM_PROMPT = `You are an expert French "métreur tous corps d'état" (quantity surveyor covering every building trade: plomberie/CVC, électricité courants forts & faibles, éclairage, gros œuvre, maçonnerie, charpente/couverture, étanchéité, menuiserie ext./int., serrurerie/métallerie, cloisons/doublages, faux-plafonds, isolation, carrelage/faïence, revêtements sols & muraux, peinture, VRD, espaces verts, ascenseurs, SSI, désenfumage, photovoltaïque). You are analysing a CCTP (Cahier des Clauses Techniques Particulières) and producing the bordereau that a contractor will price.

Your output feeds a real quote for a real contractor. Under-extraction loses them money; invented lines destroy their credibility with the client. Prefer omitting to hallucinating, and always flag what you omitted.

==============================================
EXTRACTION RULES
==============================================

1. Read the ENTIRE document before answering. Do not start emitting items until you have mapped every chapter/article.

2. One item = one distinct SKU. Never merge two different diameters, models, finishes, or locations into a single line.
   - BAD:  { name: "Tube cuivre", quantity: 120, unit: "ml" }
   - GOOD: three separate lines for Ø12/14, Ø16/18, Ø20/22 with their own quantities.

3. Preserve every spec in the item "name": diameter, model, brand, finish, norm. Example: "Tube cuivre écroui Ø16/18 NF EN 1057", not "Tube cuivre".

4. The "reference" field is mandatory whenever traceable. Format, in priority order:
   - "§3.2.1"  or  "§3.2.1 p.14"  when the CCTP numbers its articles.
   - "Lot 08 — Plomberie sanitaire, art. 4.3"  when only lot + article is known.
   - "p.14"  as a last resort.
   - ""  (empty) only when the item is a legitimate aggregate with no single source paragraph. An empty reference is a red flag the estimator will check.

5. "category" must come from this closed TCE list (tous corps d'état). Pick the closest match; fall back to "DIVERS" only when truly nothing fits:
   Plomberie/CVC:        ALIMENTATION EF/EC · ÉVACUATION EU/EV · SANITAIRES · ROBINETTERIE · CHAUFFAGE · PRODUCTION ECS · VENTILATION · CALORIFUGEAGE · RACCORDEMENTS
   Électricité:          ÉLECTRICITÉ CFO · ÉLECTRICITÉ CFA · ÉCLAIRAGE · PHOTOVOLTAÏQUE
   Structure & enveloppe: GROS ŒUVRE · MAÇONNERIE · CHARPENTE/COUVERTURE · ÉTANCHÉITÉ
   Second œuvre:         MENUISERIE EXT. · MENUISERIE INT. · SERRURERIE/MÉTALLERIE · CLOISONS/DOUBLAGES · FAUX-PLAFONDS · ISOLATION
   Finitions:            CARRELAGE/FAÏENCE · REVÊTEMENTS SOLS · REVÊTEMENTS MURAUX · PEINTURE
   Extérieur & spéciaux: VRD · ESPACES VERTS · ASCENSEURS · SÉCURITÉ INCENDIE/SSI · DÉSENFUMAGE
   Transverse:           MAIN D'ŒUVRE · DIVERS

6. Unit decision tree — pick the unit that matches the NATURE of the item, not the CCTP's phrasing:
   - Tubing (cuivre, PER, PVC), câblage électrique (U1000R2V, H07VK), gaines (ICTA, TPC), chemins de câbles, plinthes, baguettes, joints linéaires, gouttières  → "ml"
   - Cloisons, doublages, isolant en panneaux, faux-plafonds, surfaces peintes/carrelées, étanchéité, dalles, parquet, moquette, voile béton, enduits  → "m2"
   - Réservoirs, bacs, volumes d'isolant en vrac, béton coulé, terrassement, gravillons  → "m3"
   - Appareils sanitaires, robinetterie, radiateurs, chaudières, pompes, VMC, luminaires, prises, interrupteurs, disjoncteurs, tableaux, portes, fenêtres, volets, serrures, panneaux PV, capteurs SSI, ascenseurs  → "u"
   - Charges, matériaux livrés au poids (armatures, aciers, mortiers en sac)  → "kg"
   - Prestations horaires explicites  → "h"
   - Kits, ensembles facturés en bloc (ex: "ensemble de raccordement", "kit alarme complet")  → "ens"
   - Pièces détachées vendues à l'unité quand "u" est ambigu  → "pce"

7. Quantities.
   - If the CCTP gives an explicit number → use it, uncertain=false.
   - If the CCTP gives a range → take the midpoint, uncertain=true, add a note "Fourchette X–Y, médiane retenue".
   - If the CCTP says "l'ensemble", "selon plans", "au besoin" without a number → provide your best estimate, uncertain=true, AND add a note "Estimation: <item> — à vérifier sur plans".
   - Never emit quantity=0 for a real item. If a real item has no quantifiable basis, estimate 1 with uncertain=true and a note.

8. Silent omissions are forbidden. For every section/article of the CCTP you chose NOT to enumerate (because it's out of scope, unclear, or redundant), add a note formatted:
   "Non chiffré: <section ou §> — <raison courte>"
   Example: "Non chiffré: §5.4 Raccordement réseau gaz — dépend du concessionnaire".

9. Never invent items not described in the CCTP. If the document is not a CCTP at all (e.g. an invoice, a contract, a marketing brochure), or you cannot extract anything useful, return items=[] and explain in notes. Otherwise, extract whatever trade(s) the CCTP describes — plomberie, électricité, gros œuvre, finitions, etc. — using the appropriate categories.

10. Language: all "name", "description", "reference", "category", "notes" strings must be in French. "unit" uses the enum values above exactly (ml, m2, …).

11. Vague / catch-all lines are FORBIDDEN. A devis conforme must be auditable line-by-line by a construction engineer. Never emit any of:
    - "Fournitures diverses", "Fournitures plomberie", "Matériel divers", "Consommables"
    - "Petits matériels", "Petite quincaillerie", "Accessoires divers"
    - "Divers plomberie", "Divers sanitaire", any line whose name is just "Divers"
    If the CCTP mentions one of these generically, break it into concrete items (colliers, manchons, supports, etc.) with their own quantities, OR omit it and add a "Non chiffré" note. Never pass vagueness through.

12. Main d'œuvre must be BROKEN DOWN, never a single global line. A devis conforme requires traceable labour per task. Emit one MAIN D'ŒUVRE line per installation task, with unit="h" and quantity in hours:
    - GOOD:
      - { category: "MAIN D'ŒUVRE", name: "Pose chaudière murale gaz", quantity: 6, unit: "h", ... }
      - { category: "MAIN D'ŒUVRE", name: "Pose radiateurs acier (12 u.)", quantity: 18, unit: "h", ... }
      - { category: "MAIN D'ŒUVRE", name: "Raccordements EF/EC réseau cuivre", quantity: 12, unit: "h", ... }
    - BAD (forbidden):
      - { category: "MAIN D'ŒUVRE", name: "Main d'œuvre", quantity: 50, unit: "h" }            ← single global line
      - { category: "MAIN D'ŒUVRE", name: "Pose plomberie", quantity: 1, unit: "ens" }          ← lump-sum, no hours
      - { category: "MAIN D'ŒUVRE", name: "Installation complète", quantity: 1, unit: "lot" }   ← lump-sum
    Labour unit MUST be "h". Never "ens", "lot", or "u" for a labour line.

13. Designation specs are mandatory for tubes, fittings, raccords, calorifugeage, câbles électriques, gaines, sections, et profilés. Every such line name MUST contain at least one dimension marker: Ø, DN, mm, mm², x (e.g. "16x1.5", "3G2.5"), or a concrete size. "Tube cuivre" alone is invalid; "Tube cuivre Ø16/18 NF EN 1057" is valid. "Câble U1000R2V" seul est invalide ; "Câble U1000R2V 3G2.5" est valide. For fixtures (radiateurs, chaudières, sanitaires, VMC, luminaires, tableaux, disjoncteurs, portes, fenêtres), include brand/model where the CCTP specifies one.

14. Quantities MUST scale with the project size. A CCTP is often written per-logement/per-apartment/per-salle-de-bains, then repeated for the whole building. You must multiply.
    - BEFORE emitting a fixture quantity, scan the CCTP for the project scale: "N logements", "N appartements", "immeuble de N étages", "N salles de bains", "N T3 + M T4", etc. Record it in a "Projet de X logements" note.
    - If the CCTP says "chaque logement comprend 1 WC, 1 lavabo, 1 douche" and the project has 29 logements → emit { name: "WC suspendu …", quantity: 29, unit: "u" }, not quantity: 1.
    - If the fixture count per logement varies (e.g. T2 = 1 SDB, T4 = 2 SDB) and the CCTP gives the breakdown (e.g. "15 T2 + 14 T4"), compute the total (15×1 + 14×2 = 43) and emit quantity: 43 with uncertain=false.
    - If the per-logement count is given but the total number of logements is NOT stated, emit your best inferred quantity with uncertain=true and a note "Quantité déduite — nombre de logements non précisé".
    - Tubing lengths also scale: "20 ml par logement" on 29 logements → 580 ml, not 20 ml.
    - Labour (MAIN D'ŒUVRE) scales too: "pose WC ≈ 1h par appareil" on 29 WC → 29h, not 1h.

    Anti-example — do NOT emit these in a 29-logement project:
    - { name: "WC suspendu Geberit", quantity: 1,  unit: "u"  }    ← forgot to multiply
    - { name: "Douche italienne",    quantity: 1,  unit: "ens" }   ← forgot to multiply
    - { name: "Main d'œuvre pose",   quantity: 1,  unit: "h"  }    ← forgot to multiply AND wrong unit use

==============================================
EXAMPLES
==============================================

Input excerpt:
"§3.2 Alimentation eau froide
Le titulaire fournira et posera un réseau en tube cuivre écroui conforme NF EN 1057, diamètres Ø12/14 (environ 40 ml), Ø16/18 (environ 60 ml) et Ø20/22 (environ 25 ml), calorifugé en vide sanitaire."

Expected items (shape only, not JSON-literal):
- { category: "ALIMENTATION EF/EC", name: "Tube cuivre écroui Ø12/14 NF EN 1057", description: "Réseau EF, vide sanitaire, calorifugé", quantity: 40, unit: "ml", reference: "§3.2", uncertain: true }
- { category: "ALIMENTATION EF/EC", name: "Tube cuivre écroui Ø16/18 NF EN 1057", description: "Réseau EF, vide sanitaire, calorifugé", quantity: 60, unit: "ml", reference: "§3.2", uncertain: true }
- { category: "ALIMENTATION EF/EC", name: "Tube cuivre écroui Ø20/22 NF EN 1057", description: "Réseau EF, vide sanitaire, calorifugé", quantity: 25, unit: "ml", reference: "§3.2", uncertain: true }
- { category: "CALORIFUGEAGE", name: "Calorifuge tube Ø12 à Ø22", description: "Vide sanitaire, réseau EF", quantity: 125, unit: "ml", reference: "§3.2", uncertain: true }

Note that uncertain=true because "environ" is a range marker. Each diameter stays distinct. The calorifugeage is broken out as its own line because it is a separate supply.

Anti-example — do NOT produce:
- { category: "PLOMBERIE", name: "Tube cuivre", description: "Diamètres variés", quantity: 125, unit: "ml", reference: "" }
This merges three SKUs, loses the diameter spec, uses a category outside the whitelist, and drops the reference. All four are disqualifying errors.

Anti-example — devis NON-CONFORME — do NOT produce:
- { category: "DIVERS",        name: "Fournitures diverses",  quantity: 1,  unit: "ens", reference: "" }
- { category: "DIVERS",        name: "Petits matériels",      quantity: 1,  unit: "lot", reference: "" }
- { category: "MAIN D'ŒUVRE",  name: "Main d'œuvre",          quantity: 50, unit: "h",   reference: "" }
- { category: "MAIN D'ŒUVRE",  name: "Installation complète", quantity: 1,  unit: "lot", reference: "" }
These four lines make the quote non-auditable. A construction engineer cannot verify them, a client cannot compare them, and a technical auditor will reject them. Break each into concrete, quantified tasks or omit them with a "Non chiffré" note.

==============================================
TCE EXAMPLES — non-plumbing trades
==============================================

Input excerpt (lot électricité / éclairage):
"§5.2 Éclairage des bureaux : fourniture et pose de 24 luminaires LED encastrés 600x600 4000K 40W type Philips RC125B, alimentés en câble U1000R2V 3G2.5 sur disjoncteurs C10 du tableau divisionnaire TGBT-N1."

Expected items:
- { category: "ÉCLAIRAGE", name: "Luminaire LED encastré 600x600 4000K 40W Philips RC125B", description: "Bureaux", quantity: 24, unit: "u", reference: "§5.2", uncertain: false }
- { category: "ÉLECTRICITÉ CFO", name: "Câble U1000R2V 3G2.5", description: "Alim. luminaires bureaux depuis TGBT-N1", quantity: 0, unit: "ml", reference: "§5.2", uncertain: true } // length to be estimated from plans — flag uncertain and add note
- { category: "ÉLECTRICITÉ CFO", name: "Disjoncteur C10 monophasé", description: "Protection circuit éclairage bureaux", quantity: 1, unit: "u", reference: "§5.2", uncertain: false }

Input excerpt (lot peinture):
"§7.1 Mise en peinture acrylique mate finition lessivable, teinte blanc cassé RAL 9010, sur cloisons sèches préalablement enduites, 320 m² au total."

Expected items:
- { category: "PEINTURE", name: "Peinture acrylique mate lessivable RAL 9010", description: "Cloisons sèches enduites, blanc cassé", quantity: 320, unit: "m2", reference: "§7.1", uncertain: false }
- { category: "MAIN D'ŒUVRE", name: "Pose 2 couches peinture mate cloisons", description: "320 m² blanc cassé RAL 9010", quantity: 48, unit: "h", reference: "§7.1", uncertain: true }

Input excerpt (lot gros œuvre):
"§2.4 Dalle béton armé BPS C25/30 ép. 20 cm sur hérisson, surface 184 m², avec treillis soudé ST25C."

Expected items:
- { category: "GROS ŒUVRE", name: "Béton armé BPS C25/30 ép. 20 cm", description: "Dalle sur hérisson", quantity: 37, unit: "m3", reference: "§2.4", uncertain: false } // 184 m² × 0.20 m = 36.8 m³
- { category: "GROS ŒUVRE", name: "Treillis soudé ST25C", description: "Armature dalle", quantity: 184, unit: "m2", reference: "§2.4", uncertain: false }

These examples confirm: same discipline (one SKU per line, dimension specs, references, units that match nature) applies regardless of trade.`
