// Génère un CCTP éclairage réaliste (sans prix), calé sur les codes d'un
// vrai cahier de BET d'études électriques pour un bâtiment tertiaire neuf.
// Référentiel : NF C 15-100, NF EN 12464-1, RE2020, code du travail R4223-4.
//
//   node scripts/gen-cctp-eclairage-reel.mjs
//   → écrit construct-ai/test-cctps/cctp-eclairage-reel.pdf

import { jsPDF } from 'jspdf'
import fs from 'node:fs'
import path from 'node:path'

const OUT = path.resolve('test-cctps', 'cctp-eclairage-reel.pdf')
fs.mkdirSync(path.dirname(OUT), { recursive: true })

const doc = new jsPDF({ unit: 'pt', format: 'a4' })
const PAGE_W = 595, PAGE_H = 842
const LEFT = 50, RIGHT = 50, TOP = 60, BOTTOM = 60
const MAX_W = PAGE_W - LEFT - RIGHT
const LH_BODY = 13
let y = TOP
let pageNum = 1

function nextPage() {
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120)
  doc.text(`CCTP Lot 13 — Électricité courants forts & éclairage — p.${pageNum}/__`, LEFT, PAGE_H - 30)
  doc.text('SCI Plateau Pasteur — Réhabilitation tertiaire R+4 — Indice B (mai 2026)', LEFT, PAGE_H - 18)
  doc.setTextColor(0)
  doc.addPage()
  pageNum++
  y = TOP
}

function ensure(spaceNeeded) { if (y + spaceNeeded > PAGE_H - BOTTOM) nextPage() }

function h1(text) {
  ensure(40)
  y += 10
  doc.setFont('helvetica', 'bold').setFontSize(14)
  doc.text(text, LEFT, y); y += 22
  doc.setFont('helvetica', 'normal').setFontSize(10)
}
function h2(text) {
  ensure(28)
  y += 6
  doc.setFont('helvetica', 'bold').setFontSize(11.5)
  doc.text(text, LEFT, y); y += 16
  doc.setFont('helvetica', 'normal').setFontSize(10)
}
function h3(text) {
  ensure(20)
  y += 3
  doc.setFont('helvetica', 'bold').setFontSize(10.5)
  doc.text(text, LEFT, y); y += LH_BODY + 2
  doc.setFont('helvetica', 'normal').setFontSize(10)
}
function p(text) {
  doc.setFont('helvetica', 'normal').setFontSize(10)
  const lines = doc.splitTextToSize(text, MAX_W)
  for (const ln of lines) {
    ensure(LH_BODY)
    doc.text(ln, LEFT, y); y += LH_BODY
  }
  y += 3
}
function bullet(text) {
  doc.setFont('helvetica', 'normal').setFontSize(10)
  const lines = doc.splitTextToSize(text, MAX_W - 15)
  let first = true
  for (const ln of lines) {
    ensure(LH_BODY)
    if (first) { doc.text('•', LEFT + 4, y); first = false }
    doc.text(ln, LEFT + 15, y); y += LH_BODY
  }
}

// ====================== Page de garde ======================
doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(80)
doc.text('SCI PLATEAU PASTEUR', LEFT, y); y += 16
doc.setTextColor(0)
doc.setFont('helvetica', 'normal').setFontSize(10)
doc.text('14 rue Pasteur — 75011 PARIS', LEFT, y); y += 13
doc.text("Architecte mandataire : Atelier Bertrand & Lemoine — 28 rue Réaumur 75003 PARIS", LEFT, y); y += 13
doc.text("BET fluides : INGENERIA SARL — 12 quai de Jemmapes 75010 PARIS", LEFT, y); y += 24

doc.setFont('helvetica', 'bold').setFontSize(18)
doc.text('CAHIER DES CLAUSES TECHNIQUES PARTICULIÈRES', LEFT, y); y += 22
doc.text('LOT 13 — ÉLECTRICITÉ COURANTS FORTS & ÉCLAIRAGE', LEFT, y); y += 30
doc.setFont('helvetica', 'normal').setFontSize(11)
doc.text("Opération : Réhabilitation lourde d'un plateau tertiaire R+4 — 1 240 m² SHON", LEFT, y); y += 16
doc.text('Marché : appel d\'offres ouvert — procédure adaptée', LEFT, y); y += 16
doc.text('Indice : B — Mai 2026 — révision après consultation MOA', LEFT, y); y += 30

doc.setFont('helvetica', 'italic').setFontSize(9).setTextColor(90)
const intro = "Le présent CCTP a pour objet de définir l'ensemble des prestations relatives au lot Électricité courants forts et éclairage du projet de réhabilitation. Il complète, sans les contredire, les pièces écrites générales du dossier de consultation (CCAP, CCTG, CCTP général) et les plans graphiques (ARC-EL-01 à ARC-EL-09, indice B du 14/05/2026). En cas de contradiction entre les pièces, l'ordre de priorité défini au CCAP article 1.4 s'applique."
const introLines = doc.splitTextToSize(intro, MAX_W)
for (const ln of introLines) { doc.text(ln, LEFT, y); y += 12 }
doc.setTextColor(0)
nextPage()

// ====================== Sommaire ======================
h1('SOMMAIRE')
;[
  '1.  Objet et consistance des travaux',
  '2.  Documents contractuels et normes applicables',
  '3.  Hypothèses et limites de prestation',
  '4.  Caractéristiques générales des installations',
  '5.  Tableau Général Basse Tension (TGBT) et distribution',
  '6.  Câblages, cheminements et accessoires',
  '7.  Éclairage intérieur — prescriptions par local',
  '8.  Éclairage de sécurité (BAES / BAEH)',
  '9.  Éclairage extérieur et de façade',
  '10. Gestion technique et asservissements',
  '11. Petite force motrice et appareillage terminal',
  '12. Mises à la terre, liaisons équipotentielles, protection foudre',
  '13. Essais, mesures et réception',
  '14. Documents à fournir par l\'entrepreneur',
].forEach(line => { ensure(LH_BODY + 2); doc.text(line, LEFT + 10, y); y += LH_BODY + 2 })

nextPage()

// ====================== 1. Objet ======================
h1('1. OBJET ET CONSISTANCE DES TRAVAUX')
h2('1.1 Description sommaire de l\'opération')
p("L'opération porte sur la réhabilitation lourde d'un immeuble tertiaire R+4 sur RDC, surface utile 1 240 m² répartis comme suit :")
bullet("RDC : hall d'accueil 86 m², salle de réunion polyvalente 64 m², local technique 22 m², sanitaires hommes/femmes 18 m², cuisine de service 24 m², circulation 52 m².")
bullet("R+1 à R+3 (étages courants identiques) : 6 bureaux fermés moyens 14 m², 2 bureaux fermés grands 24 m², open-space 96 m², 2 salles de réunion 18 m², kitchenette 12 m², circulations + sanitaires 38 m², soit 244 m² SU par niveau.")
bullet('R+4 (étage technique partiel) : local CTA + chaufferie 48 m², archives 28 m², terrasse technique accessible 220 m² avec garde-corps.')

h2('1.2 Périmètre du présent lot')
p("Le titulaire du présent lot fournira, posera, raccordera et mettra en service l'ensemble des équipements suivants :")
bullet("Tableau Général Basse Tension neuf, depuis le départ comptage du distributeur Enedis (TURPE 5, abonnement souscrit 36 kVA par le maître d'ouvrage, raccordement existant conservé).")
bullet("Toute la distribution secondaire : tableaux divisionnaires d'étage, colonnes montantes en gaine technique TGT-01, câblage des départs lumière, prise de courant et force motrice.")
bullet("La fourniture, la pose et le raccordement de l'ensemble des luminaires intérieurs et extérieurs définis aux plans ARC-EL-04 et ARC-EL-08.")
bullet("L'éclairage de sécurité : BAES d'évacuation, BAES d'ambiance dans les locaux >50 m² ou >50 personnes, BAEH dans les locaux à sommeil. Source centrale exclue (non prévue au programme).")
bullet("La gestion d'éclairage : détection de présence, gradation DALI, scénarisation KNX dans les salles de réunion et le hall.")
bullet("La mise à la terre générale, les liaisons équipotentielles principales et secondaires, et le complément éventuel à la prise de terre existante (à vérifier par mesure préalable).")
bullet('La fourniture et la mise à jour des schémas électriques unifilaires, des étiquetages et du dossier des ouvrages exécutés.')

h2('1.3 Hors prestation du présent lot')
bullet("Le raccordement Enedis amont du disjoncteur de branchement (à charge du MOA et du distributeur).")
bullet("Le câblage courants faibles structuré (RJ45 catégorie 6A) — lot 14 Courants faibles, voir CCTP spécifique.")
bullet("Le système de sécurité incendie (SSI catégorie A) — lot 15 SSI, sauf l'alimentation 230V du tableau de signalisation qui reste à la charge du présent lot.")
bullet("Les attentes électriques pour la CVC (lot 09), la plomberie (lot 08) et la VMC (lot 09) — leur mise à disposition est à charge du présent lot mais les raccordements terminaux sont assurés par chacun de ces lots.")

nextPage()

// ====================== 2. Documents et normes ======================
h1('2. DOCUMENTS CONTRACTUELS ET NORMES APPLICABLES')
h2('2.1 Documents contractuels')
bullet("Le présent CCTP indice B daté du 14/05/2026.")
bullet("Le CCAP de la consultation.")
bullet("Le DPGF (Décomposition du Prix Global et Forfaitaire) — à remplir par le candidat, ne préjuge en rien de la valeur des prestations qui restent dues à hauteur de leur définition technique.")
bullet("Les plans graphiques de la série ARC-EL (architecte) et BET-EL (BET INGENERIA) indice B.")

h2('2.2 Normes et règlements')
p("L'entrepreneur est réputé connaître et respecter strictement les textes en vigueur, et notamment :")
bullet("NF C 15-100 (édition décembre 2002 et amendements A1 à A6) : Installations électriques à basse tension.")
bullet("NF C 14-100 : Installations de branchement à basse tension.")
bullet("NF C 17-100 / NF C 17-102 : Protection contre la foudre, paratonnerres.")
bullet("NF EN 12464-1 (Juillet 2021) : Éclairage des lieux de travail intérieurs — niveaux d'éclairement requis, UGR, IRC.")
bullet("NF EN 1838 : Éclairagisme — éclairage de secours et de sécurité.")
bullet("NF EN 50172 : Systèmes d'éclairage de sécurité.")
bullet("NF C 71-800 / C 71-801 : Blocs autonomes d'éclairage de sécurité (BAES / BAEH).")
bullet("Arrêté du 14 décembre 2011 modifié : Performance énergétique des bâtiments tertiaires (dispositif éco-énergie tertiaire / décret tertiaire).")
bullet("Code du travail, articles R4223-4 à R4223-12 : Éclairage des lieux de travail.")
bullet("RE2020 — Réglementation Environnementale 2020 et son volet « bâtiment tertiaire ».")
bullet('UTE C 15-103 : Choix des matériels en fonction des influences externes.')

h2('2.3 Marquage et certifications')
p("Tous les matériels installés porteront obligatoirement les marquages CE, NF-USE, NF-Éclairage de Sécurité (pour les BAES) et seront accompagnés des PV d'essais correspondants. Les luminaires LED porteront le marquage CE et un PV photométrique (LM-79) ainsi qu'un rapport de longévité (LM-80 / TM-21) attestant un L80B10 à 50 000 h minimum.")

nextPage()

// ====================== 3. Hypothèses ======================
h1('3. HYPOTHÈSES ET LIMITES DE PRESTATION')
h2('3.1 Influences externes')
bullet("Locaux secs intérieurs : AD1, AE1, AF1 — IP 20 minimum, IK 02 minimum.")
bullet("Sanitaires et kitchenettes : AD3, IP 24 minimum dans les volumes 1 et 2 douches éventuelles ; locaux d'eau type lave-mains classés AD3 hors volumes spéciaux.")
bullet("Local CTA et chaufferie : AA5 (température), AD3 (présence d'eau probable en cas de fuite), IP 44 minimum.")
bullet("Local archives : risque incendie BE2 (matières combustibles en quantité notable), application de la NF C 15-100 § 422.")
bullet("Façade et terrasse technique : IP 54 / IK 07 minimum, classification AD4 (intempéries).")

h2('3.2 Coordination avec les autres corps d\'état')
p("Le titulaire fournira à l'entreprise gros œuvre, avant exécution, le plan des réservations dimensionnées pour le passage des gaines techniques, des chemins de câbles principaux et des trémies de colonnes montantes. Tout percement non prévu et exécuté après coulage sera à sa charge.")

nextPage()

// ====================== 4. Caractéristiques générales ======================
h1('4. CARACTÉRISTIQUES GÉNÉRALES DES INSTALLATIONS')
h2('4.1 Tension nominale et schéma de liaison à la terre')
bullet("Tension nominale : 230 / 400 V — 50 Hz triphasé + neutre + protection.")
bullet("Schéma de liaison à la terre : TT (régime neutre à la terre côté distributeur, masses à la terre côté installation).")
bullet("Disjoncteur de branchement Enedis existant : 60 A tétrapolaire sélectif différentiel 500 mA — conservé en l'état.")

h2('4.2 Bilan de puissance prévisionnel')
p("Le bilan de puissance théorique, vérifié et complété par le titulaire, est le suivant (puissances foisonnées, coefficient 0,8 sur l'éclairage et 0,5 sur la prise de courant tertiaire) :")
bullet("Éclairage intérieur : 14,2 kW foisonnés.")
bullet("Éclairage de sécurité : 0,3 kW (alim. permanente BAES en veille).")
bullet("Éclairage extérieur et façade : 1,6 kW foisonnés.")
bullet("Prises de courant tertiaires (bureaux, salles, kitchenette) : 12,4 kW foisonnés.")
bullet("Force motrice CVC + VMC + ECS : 18,0 kW foisonnés (à confirmer par lot CVC).")
bullet("Petite force motrice diverse (hotte, sèche-mains, vidéoprojecteurs, écrans) : 4,8 kW foisonnés.")
bullet("Total prévisionnel : 51,3 kW foisonnés sur 60 kVA disponibles — réserve 17 %.")

nextPage()

// ====================== 5. TGBT ======================
h1('5. TABLEAU GÉNÉRAL BASSE TENSION (TGBT) ET DISTRIBUTION')
h2('5.1 TGBT principal — local technique RDC')
p("Le TGBT sera de marque Schneider Electric gamme Prisma G ou techniquement équivalent (Hager Univers, ABB System Pro E Power). Armoire métallique IP30/IK08, hauteur 1800 mm, largeur 800 mm, profondeur 400 mm, 6 colonnes 24 modules, peinture époxy RAL 7035.")
bullet("Jeu de barres principal cuivre 250 A, supporté tous les 400 mm, protégé contre les contacts directs par capot transparent.")
bullet("Compteur d'énergie principal triphasé classe 1 avec sortie Modbus RTU pour report en GTB (lot 14).")
bullet("Disjoncteur général tétrapolaire compact NSX160 réglable, Icu = 36 kA, Ir réglé à 100 A, déclencheur Micrologic 2.2.")
bullet("Parafoudre de Type 2 In = 20 kA / Imax = 40 kA, Up < 1,5 kV, avec disjoncteur de déconnexion C40.")
bullet("Départs principaux : 1× tableau divisionnaire RDC, 4× tableaux divisionnaires d'étage R+1 à R+4 via colonne montante, 1× départ chaufferie/CTA, 1× départ secours BAES, 1× réserve équipée (3 modules).")

h2('5.2 Tableaux divisionnaires d\'étage TD-N1 à TD-N4')
bullet("Coffret métallique encastré ou en saillie selon plan, IP30, 4 rangées 24 modules, finition RAL 7035, porte transparente verrouillable à clé triangulaire.")
bullet("Arrivée par câble 5G16 mm² U1000R2V cuivre depuis colonne montante.")
bullet("Interrupteur différentiel tête de tableau 63 A 30 mA type A, complété par un second 40 A 30 mA type AC pour circuits éclairage.")
bullet("Disjoncteurs divisionnaires courbe C, Icn 6 kA mini :")
bullet("    – 4× C10 pour circuits éclairage open-space + bureaux (8 circuits / étage).")
bullet("    – 2× C10 pour circuits éclairage circulations + sanitaires.")
bullet("    – 6× C16 pour PC bureaux (4 PC × 8 boucles).")
bullet("    – 2× C16 pour PC kitchenette protection 30 mA dédié.")
bullet("    – 1× C20 tétrapolaire pour ventilo-convecteur de plateau (attente lot CVC).")

h2('5.3 Sélectivité')
p("Le titulaire fournira la note de sélectivité globale conforme à la NF C 15-100 § 535, démontrant la sélectivité totale entre disjoncteur général et divisionnaires aval (sélectivité ampèremétrique et chronométrique pour les courants de défaut entre 1 et 6 kA).")

nextPage()

// ====================== 6. Câblages ======================
h1('6. CÂBLAGES, CHEMINEMENTS ET ACCESSOIRES')
h2('6.1 Nature des câbles')
bullet("Câbles principaux : U1000R2V cuivre, âme rigide, isolation PR, gaine PVC noire, conformes NF C 32-321.")
bullet("Câbles de commande et de signalisation : H07VK ou ses dérivés, conformes NF C 32-201.")
bullet("Câbles d'éclairage de sécurité : CR1-C1 résistant au feu 1 h, conforme NF C 32-070 cat. C1.")
bullet("Câblage BUS DALI : paire torsadée non écrantée 0,75 mm² spécifiée DALI (par ex. type Sylvania DALI Bus 2×1,5 mm² ou équivalent).")
bullet("Câblage KNX : paire torsadée écrantée KNX/EIB 2×2×0,8 mm² (par ex. type Hager TG008).")

h2('6.2 Sections et longueurs')
p("Les sections sont déterminées par calcul (chute de tension <3 % en éclairage, <5 % en prise) et confirmées par note de calcul Caneco / DIALux Evo / SEE Electrical Expert. À titre indicatif :")
bullet("Liaison TGBT → colonne montante : 5G16 mm² U1000R2V, longueur estimée 8 m.")
bullet("Colonne montante : 5G16 mm² U1000R2V sur 4 niveaux (longueur cumulée environ 28 m), passage en gaine technique TGT-01 sur échelle à câbles.")
bullet("Départ éclairage open-space : 3G2,5 mm² U1000R2V, longueur moyenne 22 ml par circuit.")
bullet("Départ éclairage circulations : 3G1,5 mm² U1000R2V, longueur moyenne 18 ml par circuit.")
bullet("Départ BAES : 3G1,5 mm² CR1-C1, longueur cumulée par étage estimée 65 ml.")
bullet("Liaison DALI bureaux : 2G0,75 mm² spécifié DALI, longueur cumulée environ 180 ml par étage.")

h2('6.3 Cheminements')
bullet("Chemins de câbles fil d'acier galvanisé type Cablofil ou équivalent, largeurs 100, 200 et 300 mm selon la nature des départs.")
bullet("Pose en faux-plafond démontable des circulations, fixation par tiges filetées Ø8 mm scellées chimiquement dans la dalle béton, espacement 1,50 m maximum.")
bullet("Goulottes PVC blanches Legrand DLP 80×55 mm 1 compartiment (courants forts) en plinthe pour les bureaux fermés.")
bullet("Goulottes plinthe 50×20 mm en sanitaires et kitchenette.")
bullet("Boîtes d'encastrement Ø67 type Batibox Legrand pour appareillage mural.")
bullet("Tubes IRL 16 et IRL 20 pour descentes verticales en cloisons sèches.")

nextPage()

// ====================== 7. Éclairage intérieur ======================
h1('7. ÉCLAIRAGE INTÉRIEUR — PRESCRIPTIONS PAR LOCAL')
h2('7.1 Niveaux d\'éclairement requis (NF EN 12464-1)')
p("Les niveaux d'éclairement moyen maintenus (Em) sur le plan utile, ainsi que l'indice de rendu des couleurs (Ra) et l'éblouissement d'inconfort (UGR), seront au minimum :")
bullet("Bureaux fermés et open-space (tâches sur écran) : Em ≥ 500 lux, Ra ≥ 80, UGR ≤ 19.")
bullet("Salles de réunion : Em ≥ 500 lux à la table, Ra ≥ 80, UGR ≤ 19, gradation manuelle ou DALI.")
bullet("Circulations : Em ≥ 100 lux, Ra ≥ 80, UGR non spécifié.")
bullet("Hall d'accueil : Em ≥ 300 lux en zone d'accueil, Em ≥ 100 lux en zone de passage, Ra ≥ 80.")
bullet("Sanitaires : Em ≥ 200 lux, Ra ≥ 80.")
bullet("Kitchenette : Em ≥ 300 lux à 1 m du sol, Ra ≥ 80.")
bullet("Cuisine de service RDC : Em ≥ 500 lux en zone de plonge et de préparation, Ra ≥ 80, IP 54 dans les volumes humides.")
bullet("Archives : Em ≥ 200 lux, Ra ≥ 80, allumage temporisé sur détection.")
bullet("Local technique CTA / chaufferie : Em ≥ 200 lux, Ra ≥ 60 acceptable, IP 44.")
bullet("Terrasse technique extérieure : Em ≥ 30 lux sur les zones de circulation pour maintenance.")

h2('7.2 Bureaux fermés et open-space — type A')
bullet("Luminaire LED encastré dalle 600×600 mm 36 W 4000 K UGR<19 type Philips CoreLine RC134B G2 OC W60L60 ou techniquement équivalent (Trilux LiveLink Plus, Disano Loira). Flux 4 100 lm, efficacité ≥ 110 lm/W.")
bullet("Maillage de 1 luminaire par 6 m² environ dans l'open-space, soit 16 luminaires par plateau de 96 m².")
bullet("Dans les bureaux fermés : 2 luminaires par bureau moyen (14 m²), 3 luminaires par bureau grand (24 m²).")
bullet("Commande : interrupteur poussoir mural à proximité de chaque entrée + détection de présence plafonnière dans l'open-space (couverture 12 à 16 m² par détecteur, type Theben PresenceLight 360-2 DE ou équivalent).")
bullet("Gradation : DALI broadcast par zone (1 zone = 1 bureau fermé, 4 zones par open-space).")

h2('7.3 Salles de réunion — type B')
bullet("Suspensions LED carrées 600×600 mm 40 W 4000 K UGR<16 type Sylvania Optix Square Pendant ou techniquement équivalent. Flux 4 600 lm, gradable DALI / DT8 Tunable White.")
bullet("4 suspensions par salle 18 m², 6 suspensions par salle polyvalente 64 m².")
bullet("Scénarios KNX préprogrammés : « réunion » 500 lx 4000 K, « présentation » 200 lx 3000 K avec luminaires latéraux atténués à 30 %, « visio » 300 lx 4000 K avec inhibition des luminaires en face de l'écran.")
bullet("Capteur de luminosité plafonnier pour daylight harvesting (gradation automatique en fonction de l'apport lumière du jour).")

h2('7.4 Circulations — type C')
bullet("Hublots LED Ø280 mm 18 W 4000 K IP54 type Sylvania Sylcircle Surface ou équivalent. Flux 1 700 lm.")
bullet("Implantation tous les 4 m linéaires, soit environ 13 hublots par étage de circulation.")
bullet("Détection de présence en plafond, temporisation 5 min, allumage 100 % détection, niveau réduit 20 % en veille permanente.")
bullet("Inhibition possible la nuit (entre 22h et 6h) sauf passage détecté.")

h2('7.5 Hall d\'accueil — type D')
bullet("Downlights LED encastrés Ø150 mm 22 W 3000 K type iGuzzini Laser Blade ou équivalent — 8 unités en zone de passage.")
bullet("Suspensions architecturales gamme bois ou métal RAL noir mat — choix du modèle exact arbitré par l'architecte sur fiche échantillons (3 références à présenter en commission).")
bullet("Bandeau LED linéaire 24 V continu IP20 type DGA Limbus haut. 12 mm — corniche périphérique 26 m linéaires, 4000 K, gradable.")

h2('7.6 Sanitaires, kitchenette, cuisine de service')
bullet("Sanitaires : 4 hublots LED Ø220 mm 12 W 4000 K IP44 par bloc.")
bullet("Kitchenette : 3 downlights LED Ø100 mm 8 W 3000 K + 1 bandeau LED sous-meuble 600 mm 8 W 3000 K éclairant le plan de travail.")
bullet("Cuisine de service : 6 luminaires LED IP65 600×600 mm 40 W 4000 K type Trilux Acuro G2 ou équivalent, lampes anti-vandales en zone plonge.")

h2('7.7 Archives')
bullet("4 réglettes LED 1500 mm 50 W 4000 K IP40 type Performance in Lighting Quark ou équivalent, fixées en plafond.")
bullet("Allumage exclusivement sur détection avec temporisation 3 min, inhibition de la commande manuelle (pas d'interrupteur mural).")

h2('7.8 Local technique et chaufferie')
bullet("3 réglettes LED 1500 mm 50 W 4000 K IP65 IK08 type Disano Hydro 938 ou équivalent.")
bullet("Commande par interrupteur étanche IP55 à l'entrée du local.")

nextPage()

// ====================== 8. Éclairage de sécurité ======================
h1('8. ÉCLAIRAGE DE SÉCURITÉ (BAES / BAEH)')
h2('8.1 Principe général')
p("Conformément à la NF EN 1838, la NF EN 50172 et l'article R4227-14 du code du travail, l'établissement (ERP de 5e catégorie type W) est équipé d'un éclairage de sécurité par blocs autonomes. Une source centrale n'est pas requise au programme. L'autonomie minimale est de 1 heure pour l'évacuation et de 5 heures pour l'éclairage d'ambiance / anti-panique des locaux à sommeil — non applicable ici.")

h2('8.2 BAES d\'évacuation (NF C 71-800, NF EN 60598-2-22)')
bullet("Blocs autonomes d'éclairage de sécurité type LEGRAND URA21 NEW SATI Connected (référence 661623) ou techniquement équivalent (Schneider Exiway, Cooper-MTH ARES).")
bullet("Flux 45 lumens, autonomie nominale 1 heure, IP43 / IK07, source LED.")
bullet("Implantation : au-dessus de chaque issue de secours, à chaque changement de direction du chemin d'évacuation, et tous les 15 mètres maximum dans les circulations rectilignes.")
bullet("Total estimé : 6 BAES par étage courant (R+1 à R+3), 7 BAES en RDC, 4 BAES en R+4 — soit environ 29 BAES.")
bullet("Câblage en CR1-C1 3G1,5 mm² depuis le tableau divisionnaire d'étage, sur disjoncteur dédié C10 protégé contre les défauts (sans différentiel haute sensibilité commun à d'autres circuits).")
bullet("Système SATI connecté : télécommande de mise au repos centralisée par bus dédié, report d'état sur GTB (lot 14) via passerelle KNX/IP — prévoir la passerelle.")

h2('8.3 BAES d\'ambiance / anti-panique')
bullet("Locaux concernés : open-space >50 m² et salle polyvalente RDC.")
bullet("Blocs flux 360 lumens type Legrand URA34 ou équivalent, 1 bloc tous les 4 mètres au minimum.")
bullet("Total estimé : 4 blocs par open-space × 3 étages + 4 blocs salle polyvalente = 16 blocs.")

h2('8.4 Étiquetage et pictogrammes')
p("Étiquetage par pictogramme conforme à la norme ISO 7010 (issue verte, hommes courant). Pictogrammes photoluminescents en complément des BAES dans les locaux à sommeil (non applicable au présent programme).")

h2('8.5 Téléservices et maintenance')
p("L'entreprise fournira un dossier de maintenance comprenant le plan d'implantation, le journal d'essais (cahier de l'entretien des installations électriques) et le mode d'emploi de la télécommande centralisée. La fonction SATI doit permettre les essais automatiques hebdomadaires (durée fonctionnelle) et trimestriels (durée d'autonomie complète).")

nextPage()

// ====================== 9. Éclairage extérieur ======================
h1('9. ÉCLAIRAGE EXTÉRIEUR ET DE FAÇADE')
h2('9.1 Façade et entrée principale')
bullet("4 appliques façade encastrées LED 12 W 3000 K IP65 IK08 type Bega 33547 ou équivalent, fixées de part et d'autre de la porte d'entrée et au-dessus de l'enseigne, finition graphite RAL 7016.")
bullet("Projecteur d'enseigne LED 24 W 4000 K orientable, alimenté en 230 V via interrupteur horaire astronomique calé sur lever / coucher du soleil + crépusculaire de réserve.")

h2('9.2 Terrasse technique R+4')
bullet("3 hublots LED 18 W 4000 K IP65 IK10 type Performance in Lighting EOS-2 ou équivalent, posés en applique sur acrotère.")
bullet("Commande exclusivement manuelle par interrupteur étanche au pied de l'accès, temporisation 30 min, voyant lumineux signalant l'état allumé.")

h2('9.3 Asservissements et gestion')
bullet("Module astronomique programmable type Theben Selekta 175 top3 ou équivalent, intégré au TGBT.")
bullet("Cellule photoélectrique de secours type Hager EE701 placée en façade nord pour les besoins de basculement en cas de panne de l'horloge astronomique.")
bullet("Plage horaire de fonctionnement : crépuscule – minuit, puis reprise 5h – aurore, hors période estivale (15 juin – 31 août) où la plage est limitée à crépuscule – 23h.")

nextPage()

// ====================== 10. Gestion ======================
h1('10. GESTION TECHNIQUE ET ASSERVISSEMENTS')
h2('10.1 Architecture')
p("Le système de gestion d'éclairage repose sur un bus DALI broadcast au niveau du local, encapsulé par des coupleurs DALI / KNX dans les tableaux divisionnaires. Le bus KNX inter-tableaux remonte les états et reçoit les ordres globaux (scénarios, horaires) depuis une passerelle KNX/IP installée dans le TGBT. La passerelle expose les variables en protocole BACnet/IP vers la GTB (lot 14).")

h2('10.2 Liste des fonctions à programmer')
bullet("Allumage / extinction par détection de présence dans tous les bureaux fermés, l'open-space, les circulations, sanitaires, archives, locaux techniques.")
bullet("Gradation automatique en fonction de l'apport de lumière du jour (daylight harvesting) dans les bureaux et l'open-space — capteurs intégrés aux luminaires côté fenêtre.")
bullet("Scénarios manuels dans les salles de réunion via clavier KNX 4 boutons type ABB SmartTouch ou équivalent.")
bullet("Programmation horaire d'extinction forcée hors heures ouvrables (lundi-vendredi 7h-20h, samedi 8h-13h, dimanche éteint).")
bullet("Visualisation des consommations d'éclairage par étage en GTB, échantillonnage 15 minutes, archivage 13 mois.")

h2('10.3 Mise en service et essais fonctionnels')
p("Une recette fonctionnelle contradictoire sera organisée avec le BET et le MOA. Chaque détecteur, chaque scénario, chaque temporisation seront testés. Un PV d'essai sera rédigé et signé par les parties.")

nextPage()

// ====================== 11. Petite force motrice ======================
h1('11. PETITE FORCE MOTRICE ET APPAREILLAGE TERMINAL')
h2('11.1 Prises de courant')
bullet("Prises 2P+T 16 A blanches type Legrand Mosaic 2 modules sur boîtier d'encastrement Batibox Ø67.")
bullet("Implantation type bureau fermé : 4 prises par poste de travail (2 prises 230 V + 2 prises 230 V dédiées informatique sur circuit séparé), 1 prise au-dessus du meuble de réception.")
bullet("Implantation type open-space : 4 prises par poste de travail intégrées au système de plinthe technique + 2 prises de service tous les 6 mètres en périphérie.")
bullet("Salle de réunion : 4 prises périphériques + 1 prise sol type Legrand Floor Box pour table centrale (avec 2× RJ45 cat 6A à charge lot 14).")
bullet("Hall d'accueil : 2 prises ménage discrètes en plinthe.")

h2('11.2 Alimentation des équipements terminaux')
bullet("Sèche-mains soufflants à air pulsé en sanitaires : 1 départ 2P+T 16 A par sèche-mains, protégé par disjoncteur dédié C16.")
bullet("Hotte aspirante cuisine de service : départ 2P+T 16 A + interrupteur à clé dans le tableau divisionnaire RDC.")
bullet("Vidéoprojecteurs salles de réunion : 1 PC 16 A en plafond, alimentée par disjoncteur dédié C10 commun avec l'écran motorisé.")

h2('11.3 Attentes pour autres lots')
bullet("CVC : 1 départ 5G2,5 mm² C20 tétrapolaire par plateau (ventilo-convecteur), 1 départ 5G6 mm² C32 tétrapolaire pour la CTA toiture.")
bullet("VMC : 1 départ 3G2,5 mm² C16 monophasé pour chaque caisson d'extraction.")
bullet("Plomberie : 1 départ 3G2,5 mm² C16 pour le ballon ECS, 1 départ 3G1,5 mm² C10 pour la pompe de relevage local technique.")
bullet("SSI : 1 départ permanent 3G1,5 mm² C10 pour le tableau de signalisation, protégé en aval par disjoncteur dédié non différentiel.")

nextPage()

// ====================== 12. Terre et foudre ======================
h1('12. MISES À LA TERRE, LIAISONS ÉQUIPOTENTIELLES, PROTECTION FOUDRE')
h2('12.1 Prise de terre')
bullet("Prise de terre existante : à mesurer en amont des travaux (mesure de la résistance Rt et de la résistance de boucle). Le titulaire transmettra un PV à l'AMO sous 15 jours de la notification du marché.")
bullet("Si Rt > 50 Ω, le titulaire complétera par un piquet de terre vertical Ø15 mm × 2 mètres en cuivre, connecté par conducteur cuivre nu 25 mm² à la barrette de coupure principale.")

h2('12.2 Liaisons équipotentielles')
bullet("Liaison équipotentielle principale (LEP) en conducteur cuivre nu 25 mm², reliée aux canalisations métalliques EF/EC, EU/EV, gaz, chauffage, ventilation, ainsi qu'aux masses des équipements en partie commune.")
bullet("Liaison équipotentielle supplémentaire (LES) en conducteur cuivre vert/jaune 2,5 mm² dans chaque sanitaire reliant la canalisation EF, EC, EV et la masse de la chauffe-eau électrique (si applicable).")

h2('12.3 Protection foudre')
p("L'analyse du risque foudre (ARF) selon la NF EN 62305-2 n'a pas été menée à ce stade. Au titre des conventions de marché, le titulaire installera un parafoudre Type 2 en tête du TGBT et un parafoudre Type 3 sur les départs courants faibles sensibles. Si une étude foudre commandée ultérieurement révèle la nécessité d'un paratonnerre, celui-ci fera l'objet d'un avenant.")

nextPage()

// ====================== 13. Essais ======================
h1('13. ESSAIS, MESURES ET RÉCEPTION')
h2('13.1 Essais à réaliser')
bullet("Mesure de la résistance d'isolement de chaque circuit : Riso ≥ 0,5 MΩ sous 500 V continu (NF C 15-100 § 612.3).")
bullet("Mesure de la continuité du conducteur de protection sur chaque socle de prise et chaque luminaire.")
bullet("Mesure de l'impédance de boucle de défaut Zs sur les départs terminaux.")
bullet("Test fonctionnel des dispositifs différentiels par bouton test + mesure du temps de coupure (instrument étalonné, type Chauvin Arnoux C.A 6116).")
bullet("Vérification de la conformité de l'éclairement (luxmètre étalonné) sur 3 points par local, comparaison avec les valeurs Em prescrites.")
bullet("Essais des BAES : test au repos (extinction visible 30 secondes) puis test d'autonomie (1 heure) sur la totalité du parc en présence du BET.")
bullet("Recette fonctionnelle de la gestion d'éclairage (scénarios, détection, asservissements).")

h2('13.2 Documents à fournir avant réception')
bullet("Schémas électriques unifilaires et multifilaires à jour, indice « exécution finale », au format DWG + PDF.")
bullet("Plans d'implantation des luminaires et appareillage à jour.")
bullet("Notice de fonctionnement et notice de maintenance des installations.")
bullet("Procès-verbaux de mesure (isolement, boucle de défaut, terre).")
bullet("Certificats CE et NF de chaque matériel installé.")
bullet("Carnet d'identité numérique du tableau (référencement Schneider EcoStruxure ou équivalent).")
bullet("Liste des pièces de rechange recommandées pour 2 ans d'exploitation.")
bullet("Rapport CONSUEL conforme à l'attestation Q15 (attestation de conformité installation tertiaire neuve / rénovée).")

nextPage()

// ====================== 14. Documents ======================
h1('14. DOCUMENTS À FOURNIR PAR L\'ENTREPRENEUR')
h2('14.1 En phase de remise des offres')
bullet("Mémoire technique détaillé indiquant les marques et références exactes proposées (matériels équivalents techniquement à ceux cités au présent CCTP).")
bullet("Note de calcul photométrique DIALux Evo ou Relux par local représentatif (au minimum : bureau fermé moyen, open-space, salle de réunion, hall, circulation, sanitaires).")
bullet("Note de calcul électrique Caneco BT ou équivalent justifiant les sections, chutes de tension et sélectivité.")
bullet("Planning d'exécution prévisionnel cohérent avec le planning général du chantier (à valider par l'OPC).")
bullet("Liste des sous-traitants envisagés et leurs qualifications.")

h2('14.2 En phase d\'exécution')
bullet("Fiches techniques de chaque matériel pour visa du BET avant approvisionnement.")
bullet("Échantillons physiques des luminaires hall et salles de réunion pour validation architecte / MOA.")
bullet("Plans d'exécution (EXE) au 1/50e indice ascendant.")

h2('14.3 En phase de réception')
bullet("DOE complet en 3 exemplaires papier + 1 numérique sur clé USB ou portail collaboratif du MOE.")
bullet("Procès-verbaux d'essais signés.")
bullet("Attestation CONSUEL Q15 validée par le distributeur.")
bullet("Garanties contractuelles : 1 an de parfait achèvement, 2 ans de bon fonctionnement des équipements (biennale), 10 ans de garantie décennale sur les ouvrages couverts.")

p(" ")
p("FIN DU CCTP — LOT 13 ÉLECTRICITÉ COURANTS FORTS & ÉCLAIRAGE")
p("Document établi par INGENERIA SARL — visé par l'architecte mandataire — pour le compte de la SCI PLATEAU PASTEUR.")

// Re-stamp footers with correct total page count
const totalPages = pageNum
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i)
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(120)
  doc.text(`CCTP Lot 13 — Électricité courants forts & éclairage — p.${i}/${totalPages}`, LEFT, PAGE_H - 30)
  doc.text('SCI Plateau Pasteur — Réhabilitation tertiaire R+4 — Indice B (mai 2026)', LEFT, PAGE_H - 18)
}

fs.writeFileSync(OUT, Buffer.from(doc.output('arraybuffer')))
const sizeKB = (fs.statSync(OUT).size / 1024).toFixed(1)
console.log(`OK — wrote ${OUT}`)
console.log(`     ${totalPages} pages — ${sizeKB} KB`)
