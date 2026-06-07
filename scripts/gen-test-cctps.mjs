// Génère des CCTPs synthétiques réalistes pour tester l'extraction TCE
// sur plusieurs corps d'état. Texte calé sur les usages réels (références
// d'articles, normes NF, dimensions, marques courantes du marché français).
//
// node scripts/gen-test-cctps.mjs

import { jsPDF } from 'jspdf'
import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('test-cctps')
fs.mkdirSync(OUT_DIR, { recursive: true })

function renderCctp(filename, title, body) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const left = 40
  let y = 60
  const lineHeight = 14
  const maxWidth = 515

  doc.setFont('helvetica', 'bold').setFontSize(16)
  doc.text(title, left, y); y += 28

  doc.setFont('helvetica', 'normal').setFontSize(10)

  for (const block of body) {
    if (block.heading) {
      y += 6
      doc.setFont('helvetica', 'bold').setFontSize(11)
      doc.text(block.heading, left, y); y += lineHeight + 2
      doc.setFont('helvetica', 'normal').setFontSize(10)
    }
    if (block.text) {
      const lines = doc.splitTextToSize(block.text, maxWidth)
      for (const line of lines) {
        if (y > 800) { doc.addPage(); y = 60 }
        doc.text(line, left, y); y += lineHeight
      }
    }
  }
  const out = path.join(OUT_DIR, filename)
  fs.writeFileSync(out, Buffer.from(doc.output('arraybuffer')))
  console.log('wrote', out, (fs.statSync(out).size / 1024).toFixed(1) + 'KB')
}

// 1) Éclairage / électricité — réhabilitation bureaux R+2
renderCctp(
  'cctp-eclairage-bureaux.pdf',
  'CCTP — Lot 12 Électricité / Éclairage — Réhabilitation bureaux RUE PASTEUR 75011 PARIS',
  [
    { heading: 'Article 1 — Généralités' , text: "Le présent CCTP décrit les travaux d'électricité courants forts et d'éclairage pour la réhabilitation d'un plateau de bureaux de 480 m² situé 14 rue Pasteur, 75011 Paris. Maître d'ouvrage : SCI PASTEUR INVEST. Norme NF C 15-100 applicable." },
    { heading: 'Article 2.1 — Tableau divisionnaire TGBT-N1' , text: "Fourniture et pose d'un tableau divisionnaire Schneider Prisma G 18 modules, IP30, comprenant : 1 interrupteur différentiel 63A 30mA type AC, 4 disjoncteurs C10 monophasés pour circuits éclairage, 3 disjoncteurs C16 monophasés pour PC, 1 disjoncteur C20 tétra pour climatisation. Étiquetage gravé obligatoire." },
    { heading: 'Article 2.2 — Câblage de distribution' , text: "Câble U1000R2V 3G2.5 mm² pour circuits éclairage : 180 ml posés sous chemin de câbles fil acier galvanisé largeur 100 mm (45 ml). Câble U1000R2V 3G1.5 mm² pour circuits commande : 60 ml. Câble U1000R2V 5G6 mm² pour alimentation climatisation : 25 ml. Toutes liaisons en conducteurs cuivre, sections conformes NF C 15-100." },
    { heading: 'Article 3.1 — Éclairage des bureaux' , text: "Fourniture et pose de 32 luminaires LED encastrés dalle 600x600 mm 36W 4000K UGR<19 type Philips CoreLine RC134B, fixés en faux-plafond démontable. Détection de présence intégrée DALI pour 12 luminaires en zones de circulation." },
    { heading: 'Article 3.2 — Éclairage des circulations' , text: "Fourniture et pose de 8 hublots LED IP54 18W 4000K diam 280 mm type Sylvania Sylcircle, et de 14 spots LED encastrés 8W 3000K diam 90 mm type Aric Lirio pour halls d'entrée." },
    { heading: 'Article 3.3 — Éclairage de sécurité' , text: "Fourniture et pose de 18 blocs autonomes d'éclairage de sécurité BAES 45 lumens 1h type Legrand URA21 avec télécommande Mod 4M. Liaison en câble CR1 1.5 mm² (220 ml)." },
    { heading: 'Article 4.1 — Prises de courant' , text: "Fourniture et pose de 64 prises 2P+T 16A blanches type Legrand Mosaic montées sur boîtiers encastrés. 12 prises RJ45 cat 6 type Legrand LCS3 pour le réseau informatique." },
    { heading: 'Article 4.2 — Goulottes et appareillage' , text: "Goulotte PVC blanche 80x55 mm Legrand DLP : 95 ml. Goulotte plinthe 50x20 mm : 120 ml. Boîtes d'encastrement Ø67 Batibox : 96 u." },
    { heading: 'Article 5 — Main d\'œuvre' , text: "Mise en œuvre par électriciens qualifiés (qualifs Qualifelec E2). Repli intégral des cartons et chutes en fin de chantier." },
  ]
)

// 2) Gros œuvre + maçonnerie — extension RDC maison individuelle
renderCctp(
  'cctp-gros-oeuvre-extension.pdf',
  'CCTP — Lot 02 Gros Œuvre / Maçonnerie — Extension R+0 maison individuelle CHEMIN DES OLIVIERS 13100 AIX-EN-PROVENCE',
  [
    { heading: 'Article 1 — Description' , text: "Extension en RDC d'une maison individuelle existante, surface créée 38 m² hors œuvre brute, hauteur libre 2.60 m sous plafond. Fondations en semelles filantes BA, élévation en parpaings creux, dalle béton armé sur hérisson." },
    { heading: 'Article 2.1 — Terrassement' , text: "Décapage de la terre végétale sur 25 cm d'épaisseur, surface 50 m² (12.5 m³). Fouilles en rigole pour semelles filantes : 18 ml × 0.50 m × 0.50 m = 4.5 m³. Évacuation des déblais en décharge agréée." },
    { heading: 'Article 2.2 — Semelles filantes' , text: "Béton de propreté C12/15 ép. 5 cm : 9 m². Béton armé C25/30 pour semelles filantes 50x30 cm : 2.7 m³. Armatures haute adhérence HA10 longitudinales (4 fils) + cadres HA6 espacés 25 cm : ratio 80 kg/m³ soit 220 kg." },
    { heading: 'Article 2.3 — Soubassement' , text: "Murs en parpaings creux NF 20x20x50 cm sur 60 cm de hauteur : 11.4 m². Chaînage horizontal BA section 20x20 cm armé 4 HA10 : 19 ml. Étanchéité bitumineuse SBS 4 mm collée à chaud sur faces extérieures : 11.4 m²." },
    { heading: 'Article 3.1 — Dalle sur hérisson' , text: "Hérisson de cailloux 20/40 ép. 20 cm sur géotextile : 38 m². Film polyéthylène 200μ. Dalle béton armé C25/30 ép. 12 cm avec treillis soudé ST25C : 4.56 m³ + 38 m² treillis. Surfacage hélicoptère finition lissée." },
    { heading: 'Article 3.2 — Élévation' , text: "Murs en parpaings creux NF 20x20x50 cm hauteur 2.80 m : 32 m². Linteaux préfabriqués BA pour ouvertures (1 baie 2.40 m + 2 fenêtres 1.20 m) : 4.80 ml. Chaînage horizontal supérieur BA 20x20 cm armé : 24 ml." },
    { heading: 'Article 3.3 — Réservations & enduits' , text: "Réservations pour passages techniques (gaines plomberie + électricité) : 12 u. Enduit ciment-chaux taloché extérieur 2 couches : 32 m². Enduit intérieur ciment dressé : 32 m². Armature toile de verre maillage 4x4 mm dans enduit extérieur : 32 m²." },
    { heading: 'Article 4 — Main d\'œuvre' , text: "Maçons qualifiés N3P2 minimum. Coffrages bois traditionnels pour ouvrages BA. Échafaudage de pied + garde-corps conformes R408 inclus." },
  ]
)

// 3) Peinture + revêtements — appartement 4 pièces
renderCctp(
  'cctp-peinture-appartement.pdf',
  'CCTP — Lot 09 Peinture / Revêtements muraux — Appartement T4 92 m² AVENUE FOCH 75116 PARIS',
  [
    { heading: 'Article 1 — Description des travaux' , text: "Remise en peinture intégrale d'un appartement T4 de 92 m² habitables comprenant : entrée, séjour, cuisine, 3 chambres, 2 salles de bains, 2 WC, dégagement. Hauteurs sous plafond 2.70 m." },
    { heading: 'Article 2.1 — Préparation des supports' , text: "Brossage et époussetage de toutes surfaces : 480 m². Rebouchage des fissures et trous au mastic acrylique : forfait 1 ens. Ponçage des plâtres au papier 120 : 480 m². Sous-couche d'impression universelle Dulux Valentine Diamond : 480 m²." },
    { heading: 'Article 2.2 — Peinture plafonds' , text: "Peinture acrylique mate blanche RAL 9010 type Tollens Bondex 2 couches sur plafonds plâtre, lessivable classe 1 : 92 m²." },
    { heading: 'Article 2.3 — Peinture murs séjour + chambres' , text: "Peinture acrylique velours lessivable Sikkens Alpha Tempo 2 couches teinte gris perle NCS S 2000-N : murs séjour + 3 chambres = 240 m². Bandes de protection + bâches imperméables fournies." },
    { heading: 'Article 2.4 — Peinture pièces humides' , text: "Peinture acrylique satinée lessivable classe 1 Ripolin Hydropro 2 couches sur murs salles de bains et WC (résistance humidité) : 86 m². Teinte blanc cassé RAL 9001." },
    { heading: 'Article 3.1 — Carrelage sols pièces humides' , text: "Fourniture et pose de carrelage grès cérame 60x60 cm type Marazzi Treverkmore beige clair sur sols salles de bains et WC : 14 m². Pose collée mortier flex C2, joints époxy 3 mm gris ciment, plinthes assorties : 18 ml." },
    { heading: 'Article 3.2 — Faïence murale' , text: "Fourniture et pose faïence 20x40 cm type Porcelanosa Marmi Bianco brillante sur murs douche et baignoire : 42 m². Pose collée, joints fins 2 mm. Profilés d'angle inox brossé : 24 ml." },
    { heading: 'Article 3.3 — Parquet stratifié' , text: "Fourniture et pose parquet stratifié Quick-Step Impressive chêne naturel ép. 8 mm pose flottante sur sous-couche acoustique 3 mm : 78 m² (séjour + chambres + entrée). Plinthes MDF assorties hauteur 70 mm : 96 ml." },
    { heading: 'Article 4 — Main d\'œuvre' , text: "Mise en œuvre par peintres et carreleurs qualifiés. Protection mobilier client par bâches PE, nettoyage final inclus." },
  ]
)

// 4) Multi-lots TCE — école maternelle (mini "tous corps d'état")
renderCctp(
  'cctp-multilot-ecole.pdf',
  'CCTP — Construction école maternelle 4 classes RUE DU PARC 33000 BORDEAUX — Extrait multi-lots',
  [
    { heading: 'LOT 03 — Charpente / Couverture' , text: "Charpente fermettes industrielles bois lamellé-collé classe C24, portée 12 m, entraxe 60 cm : 280 m². Couverture en tuiles terre cuite type Imerys H10 grand moule : 320 m². Faîtage scellé mortier + closoir ventilé : 24 ml. Gouttières aluminium 33 dev. teinte RAL 7016 : 64 ml. Descentes Ø100 mm aluminium : 18 ml." },
    { heading: 'LOT 04 — Étanchéité' , text: "Étanchéité bicouche bitumineuse SBS sur toiture-terrasse technique : 95 m² avec relevés sur acrotères 0.40 m. Isolation thermique laine de roche Rockwool ROCKACIER B Énergie ép. 120 mm : 95 m². Évacuations pluviales 8 u avec crapaudines fonte." },
    { heading: 'LOT 05 — Menuiseries extérieures' , text: "Fourniture et pose de 12 fenêtres aluminium Schüco AWS 75 BS.SI ouvrant à la française, double vitrage 4-16-4 argon Ug=1.1, dim. 1.20x1.40 m. 4 portes-fenêtres alu coulissantes 2 vantaux 2.40x2.10 m. Une porte d'entrée aluminium isolante 1.00x2.20 m type Bel'M Florida." },
    { heading: 'LOT 06 — Cloisons / Doublages' , text: "Cloisons plaques de plâtre BA13 Knauf sur ossature métallique 48/35 : 380 m² (entraxe montants 60 cm). Doublages thermo-acoustiques BA13 + laine minérale 100 mm sur murs périphériques : 220 m². Plénums faux-plafonds dalles minérales Armstrong Bioguard 600x600 mm : 240 m²." },
    { heading: 'LOT 07 — Menuiseries intérieures' , text: "Blocs-portes intérieurs en chêne plaqué 90x215 cm âme alvéolaire, huisserie chêne, serrure tubulaire BLOCFER : 22 u. Plinthes MDF blanchies haut 80 mm : 320 ml. Habillage radiateurs MDF perforé : 8 u." },
    { heading: 'LOT 08 — Plomberie sanitaire' , text: "Tubes PER Ø16x2 mm pour alim. EF/EC sous gaine ICTA : 180 ml. Lavabos enfants Geberit Bambini fixés à 60 cm : 8 u. WC suspendus enfants Geberit Selnova 4-6 L cuvette basse : 8 u. Robinetterie thermostatique mitigeurs Grohe Eurosmart Cosmopolitan : 16 u. Évacuation PVC NF Ø40 (lavabos) 35 ml et PVC Ø100 (WC) 24 ml." },
    { heading: 'LOT 09 — Chauffage / Ventilation' , text: "Chaudière gaz à condensation murale De Dietrich Naneo PMC-S 30 kW : 1 u. Radiateurs aluminium Acova Cotona 1000x500 mm 750W : 14 u. Centrale VMC double flux Aldes Dee Fly Cube 370 m³/h : 1 u. Réseau gaines isolées Ø150 mm : 95 ml. Bouches d'extraction acier blanc Ø125 mm : 16 u." },
    { heading: 'LOT 10 — Électricité courants forts' , text: "Tableau général TGBT armoire Schneider Prisma Plus G 36 modules : 1 u. Câble U1000R2V 3G2.5 pour circuits éclairage : 240 ml. Câble U1000R2V 3G1.5 commande : 80 ml. Disjoncteurs C10 mono : 14 u. Disjoncteurs C16 mono : 18 u. Différentiels 30 mA type AC 40A : 6 u." },
    { heading: 'LOT 11 — Éclairage' , text: "Luminaires LED encastrés dalle 600x600 36W 4000K Philips RC134B en classes et salles d'activités : 56 u. Hublots LED 18W 4000K IP65 dans préau et sanitaires : 18 u. Blocs autonomes BAES Legrand URA21 45 lumens 1h : 22 u." },
    { heading: 'LOT 12 — Serrurerie / Métallerie' , text: "Garde-corps acier galvanisé thermo-laqué RAL 9006 haut. 1.10 m sur préau : 18 ml. Portail coulissant 2 vantaux 4.00 m galvanisé : 1 u. Grilles de défense fenêtres RDC : 12 u." },
    { heading: 'LOT 13 — Carrelage / Faïence' , text: "Carrelage grès cérame 30x30 cm antidérapant R10 type Marazzi M-Action gris : 285 m² (classes + circulations). Faïence 20x30 cm blanche brillante en sanitaires : 48 m². Joints époxy ciment gris clair 3 mm." },
    { heading: 'LOT 14 — Peinture' , text: "Peinture acrylique mate plafonds RAL 9010 Tollens Bondex 2 couches : 280 m². Peinture velours lavable RAL 1015 (jaune pastel) sur murs classes : 220 m². Peinture satinée lessivable classe 1 sanitaires : 90 m². Boiseries laquées brillantes RAL 9010 : 65 m²." },
    { heading: 'LOT 15 — VRD / Espaces verts' , text: "Enrobé bitumineux BBSG 0/10 sur cour : 480 m² (ép. 6 cm). Bordures béton P1 chasse-roue : 95 ml. Gazon en plaques type \"Sport mixture\" Limagrain : 320 m². Plantations 8 arbres tiges hautes Acer platanoides hauteur 2.50/3.00 m." },
  ]
)

console.log('OK — generated', fs.readdirSync(OUT_DIR).length, 'CCTPs in', OUT_DIR)
