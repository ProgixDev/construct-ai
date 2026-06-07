// Vérifie que unitPriceFor renvoie 0 pour les lignes TCE non plomberie
import { unitPriceFor } from '../features/quote/mappers/pricing.ts'

const SUPPLIER_PRICES = [16.80, 10.20, 370.00, 1820.00, 285.00] // auto

const samples = [
  { category: 'ÉLECTRICITÉ CFO', name: 'Tableau divisionnaire Schneider', quantity: 1, unit: 'u' },
  { category: 'ÉCLAIRAGE', name: 'Luminaire LED encastré Philips', quantity: 32, unit: 'u' },
  { category: 'GROS ŒUVRE', name: 'Béton armé C25/30', quantity: 4.5, unit: 'm3' },
  { category: 'PEINTURE', name: 'Peinture acrylique mate RAL 9010', quantity: 92, unit: 'm2' },
  { category: 'CARRELAGE/FAÏENCE', name: 'Grès cérame 60x60', quantity: 14, unit: 'm2' },
  { category: 'CHARPENTE/COUVERTURE', name: 'Tuiles terre cuite Imerys H10', quantity: 320, unit: 'm2' },
  { category: 'MENUISERIE EXT.', name: 'Fenêtre alu Schüco AWS 75', quantity: 12, unit: 'u' },
  // plomberie (doivent garder un prix non-nul)
  { category: 'ALIMENTATION EF/EC', name: 'Tube cuivre Ø16/18 NF EN 1057', quantity: 60, unit: 'ml' },
  { category: 'SANITAIRES', name: 'WC suspendu Geberit', quantity: 8, unit: 'u' },
  { category: 'CHAUFFAGE', name: 'Radiateur acier 1000x500', quantity: 14, unit: 'u' },
  { category: "MAIN D'ŒUVRE", name: 'Pose radiateurs', quantity: 18, unit: 'h' },
]

console.log('Catégorie'.padEnd(22), 'Item'.padEnd(38), 'Unit', '   Prix')
console.log('-'.repeat(80))
for (const it of samples) {
  const p = unitPriceFor(it, SUPPLIER_PRICES)
  const flag = p === 0 ? '← VIDE (saisie manuelle)' : ''
  console.log(it.category.padEnd(22), it.name.slice(0, 38).padEnd(38), it.unit.padEnd(4), (p.toFixed(2)+'€').padStart(9), flag)
}
