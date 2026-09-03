CITICIGARS COMMERCE OPERATING SYSTEM
Full Business Context, Product Vision & Build Specification — V2.0
Confidentiel — document de travail — 3 septembre 2026
---
MESSAGE À REPLIT — À LIRE AVANT TOUTE LIGNE DE CODE
Vous ne recevez pas un simple projet de refonte d’Admin.
Vous recevez l’environnement opérationnel, commercial et informationnel de CitiCigars, une maison de cigares premium au Cameroun qui veut devenir la maison de référence du cigare premium au Cameroun, et qui veut bâtir un avantage concurrentiel durable par une meilleure connaissance du produit, du client, du stock, des achats, du cash et de la décision.
Le moteur transactionnel de stock déjà construit est une fondation précieuse. Il est techniquement accepté sur staging et doit être préservé. En revanche, l’expérience utilisateur, l’architecture informationnelle, les outils analytiques, le CRM, le CMS, le corporate, le club, les événements, les workflows commerciaux, les agents et les interfaces peuvent être repensés de manière ambitieuse.
Le mandat est volontairement plus large qu’un OMS.
> **Construisez le système d’exploitation commercial de CitiCigars.**
Nous vous donnons :
notre réalité ;
nos problèmes ;
nos ambitions ;
les invariants à ne pas casser ;
les domaines qui doivent exister ;
les décisions déjà prises ;
les capacités futures à anticiper dès maintenant.
Nous ne voulons pas vous prescrire chaque écran ou chaque interaction. Nous voulons que vous compreniez profondément l’entreprise puis que vous proposiez la meilleure expérience possible.
> **Surprenez-nous dans l’UX, l’architecture de navigation, les dashboards, les visualisations, les drill-downs, les workflows et l’intégration intelligente des agents.**
>
> **Ne soyez jamais créatifs avec la vérité historique, le stock, les coûts, les identités produit ou les écritures financières.**
---
PARTIE I — COMPRENDRE CITICIGARS AVANT DE CONSTRUIRE
1. Qui nous sommes
CitiCigars est une maison de cigares premium opérant au Cameroun.
Notre ambition n’est pas d’être simplement un revendeur avec un catalogue en ligne. Nous voulons devenir une référence locale en combinant :
une sélection exigeante de grandes maisons et de références reconnues ;
une vraie expertise produit ;
une capacité de conseil personnalisée ;
une excellente disponibilité et une exécution fiable ;
des expériences autour du cigare ;
des partenariats avec hôtels, lounges, restaurants, marques de spiritueux et entreprises ;
une capacité de gifting personnel et corporate ;
une connaissance client de plus en plus fine ;
un système d’information capable d’augmenter la qualité de nos décisions.
Notre promesse implicite doit devenir :
> **Le bon cigare, pour la bonne personne, au bon moment, avec une excellente exécution.**
Le logiciel doit nous aider à rendre cette promesse scalable.
---
2. Notre ambition stratégique
La cible n’est pas « avoir un bel ERP ».
La cible est de construire un actif opérationnel qui nous permette de :
mieux acheter ;
mieux stocker et tracer ;
mieux vendre ;
mieux connaître nos clients ;
mieux les relancer ;
mieux recommander ;
mieux encaisser ;
mieux mesurer la marge et le capital immobilisé ;
mieux exploiter les événements, partenariats et opportunités corporate ;
prendre de meilleures décisions que la concurrence.
Le système doit faire gagner du temps, réduire les erreurs et créer une qualité de décision que les concurrents peuvent difficilement reproduire manuellement.
---
3. Notre marché : le Cameroun n’est pas un e-commerce nord-américain
Le système doit être conçu pour le commerce réel au Cameroun, pas pour une fiction de commerce 100 % web.
3.1 Mobile et conversation
Le mobile est central.
La relation commerciale passe fortement par :
téléphone ;
WhatsApp ;
recommandations ;
réseau ;
conversations directes ;
relances personnelles ;
bouche-à-oreille ;
événements et rencontres.
Le site web reste important pour :
crédibiliser la marque ;
montrer le catalogue ;
informer ;
inspirer ;
permettre une découverte autonome ;
soutenir les campagnes ;
servir de destination depuis les réseaux sociaux.
Mais le site n’est pas le seul centre du commerce.
3.2 La friction tue l’adoption
Un opérateur ou un commercial qui doit remplir un formulaire long contournera le système.
Un client mobile qui doit franchir trop d’étapes abandonnera.
Donc :
formulaires courts ;
smart defaults ;
recherche rapide ;
actions fréquentes accessibles immédiatement ;
informations utiles au premier écran ;
capacité de reprendre une interaction commerciale là où elle a commencé.
3.3 Le relationnel est un actif
Dans ce marché, la relation elle-même est une donnée métier.
Il faut pouvoir savoir :
qui connaît qui ;
qui a introduit le client ;
comment le prospect est arrivé ;
qui entretient la relation ;
quand la dernière interaction a eu lieu ;
quel est le prochain geste attendu ;
quel événement ou partenaire a généré la relation.
Le CRM ne doit donc pas être un carnet d’adresses. Il doit devenir une mémoire commerciale partagée.
---
4. Le challenge commercial principal : sortir du premier cercle
Une partie importante des premières ventes d’une entreprise comme CitiCigars peut naturellement provenir :
du réseau du fondateur ;
d’amis ;
de connaissances ;
de recommandations directes ;
de relations existantes.
Ce modèle crée de la traction, mais il ne scale pas suffisamment.
Le système doit nous aider à sortir progressivement de ce premier cercle et à construire une machine commerciale reproductible :
inconnu → lead → prospect qualifié → conversation → recommandation → offre → commande → encaissement → satisfaction → réachat → ambassadeur
Il faut savoir :
d’où vient chaque lead ;
pourquoi il a acheté ou n’a pas acheté ;
ce qu’il aime ;
quand le relancer ;
quoi lui proposer ;
ce qui déclenche ses achats ;
si un événement, un partenaire, une campagne ou un client l’a amené ;
quel canal convertit le mieux ;
quelle relation mérite du temps.
Le but est de faire du système un moteur de croissance, pas seulement un registre de ventes.
---
5. Notre avantage compétitif recherché
Nous ne gagnerons pas durablement seulement en baissant les prix.
Nous voulons construire plusieurs avantages combinés :
5.1 Product intelligence
Connaître précisément les cigares, leurs caractéristiques, leur DNA, leurs distinctions, leurs formats et les sources qui prouvent ces informations.
5.2 Customer intelligence
Connaître progressivement les goûts, habitudes, préférences, budgets, occasions, historique et potentiel de chaque client.
5.3 Inventory truth
Savoir à tout moment :
ce que nous détenons ;
où cela se trouve ;
d’où cela vient ;
ce qui est réservé ;
ce qui est en dépôt ;
ce qui a été vendu ;
comment une quantité actuelle s’explique historiquement.
5.4 Purchasing intelligence
Acheter non pas parce qu’une promotion semble bonne, mais parce que le produit, le coût rendu, le stock, la rotation, la marge, la demande et le cash rendent l’achat pertinent.
5.5 Decision intelligence
Transformer les données en :
alertes ;
explications ;
recommandations ;
actions proposées.
5.6 Execution quality
Une bonne recommandation sans stock disponible, un bon produit mal suivi ou une belle relation non relancée ne crée pas de valeur.
Le système doit relier l’analyse à l’action.
---
6. Nos grands univers commerciaux
Le système doit être conçu dès maintenant pour couvrir plusieurs moteurs de revenus, même si tous ne sont pas activés immédiatement.
6.1 B2C
Vente directe aux particuliers :
boîtes ;
packs ;
samplers ;
accessoires lorsque pertinents ;
gifting ;
recommandations personnalisées.
6.2 B2B / Corporate
Entreprises achetant :
cadeaux clients ;
cadeaux dirigeants ;
cadeaux partenaires ;
coffrets de fin d’année ;
opérations de prestige ;
événements ;
expériences privées ;
commandes récurrentes.
6.3 Hôtels / lounges / restaurants
Partenariats pouvant inclure :
dépôt ;
sélection dédiée ;
animation ;
pairing ;
vente ;
événement ;
commission ou modèle commercial spécifique.
6.4 Événements
Aujourd’hui CitiCigars peut participer, fournir des cigares, être partenaire, conseiller ou animer.
Demain CitiCigars peut :
produire ses propres événements ;
vendre des billets ;
inviter des clients ;
gérer des sponsors ;
orchestrer les stocks événementiels ;
mesurer la rentabilité ;
transformer les participants en clients.
6.5 Club CitiCigars
Le futur club doit être prévu architecturalement dès maintenant.
Les avantages exacts ne sont pas encore figés et ne doivent pas être inventés. En revanche, l’architecture doit pouvoir gérer :
adhésion ;
statut ;
niveau/tier configurable ;
date d’entrée ;
renouvellement ;
avantages configurables ;
événements réservés ;
accès prioritaire ;
préférences ;
historique de participation ;
offres privées ;
communication ciblée ;
éventuelle facturation d’adhésion ;
éventuelles règles de qualification.
6.6 Gifting
Le gifting doit être un vrai univers :
personnel ;
VIP ;
VVIP ;
corporate ;
campagnes saisonnières ;
commandes multiples ;
personnalisation ;
destinataires multiples ;
livraison ;
suivi corporate.
---
7. Nos segments clients à prévoir
Le modèle CRM ne doit pas enfermer l’entreprise dans un seul type de client.
Au minimum :
7.1 Individu
Un particulier qui achète pour lui-même ou pour offrir.
7.2 Amateur régulier
Client récurrent dont les goûts et habitudes peuvent être appris.
7.3 VIP / relation stratégique
Client dont la valeur ne se résume pas à son CA immédiat :
influence ;
réseau ;
introductions ;
rôle institutionnel ou commercial ;
potentiel événementiel.
7.4 Acheteur cadeau
Peut ne pas être lui-même amateur de cigare.
7.5 Entreprise
Compte corporate avec plusieurs contacts :
décideur ;
acheteur ;
finance ;
bénéficiaire ;
assistant ;
direction.
7.6 Partenaire commercial
Hôtel, lounge, restaurant, spiritueux, agence événementielle, distributeur potentiel.
7.7 Prospect
Personne ou organisation encore non cliente.
7.8 Membre du Club
Un membre est un rôle/statut supplémentaire, pas nécessairement un type de client séparé.
Les segments doivent être configurables et cumulables.
---
8. Notre réalité produit : un cigare n’est pas un SKU
C’est un principe structurant.
Le système doit distinguer clairement plusieurs niveaux d’identité.
8.1 Cigar ID canonique
Le Cigar ID `CTGxxxxxx` représente l’identité canonique d’un cigare dans notre référentiel de connaissance.
Il doit survivre :
aux changements de prix ;
aux changements de fournisseur ;
aux changements de packaging ;
aux changements de SKU commercial ;
aux changements de stock.
Il représente le cigare lui-même.
8.2 Cigar Master
Le Cigar Master peut comprendre, selon les données prouvées :
maison/manufacturer ;
marque ;
série ;
nom ;
vitole ;
format ;
dimensions ;
box-pressed ;
pays ;
wrapper ;
binder ;
filler ;
strength ;
DNA ;
sweetness ;
signatures ;
awards ;
ratings ;
sources ;
evidence ;
statut de recherche ;
statut de publication.
8.3 Produit commercial
Un produit commercial est ce que CitiCigars choisit effectivement d’offrir.
Il peut être :
une boîte ;
un pack ;
un sampler ;
un accessoire ;
un bundle.
8.4 SKU
Le SKU identifie une référence commerciale/opérationnelle.
Le SKU ne doit pas être confondu avec le Cigar ID.
8.5 Identité physique de stock
Le stock actuel utilise l’identité exacte :
> **SKU + type + packSize**
Exemples :
Box ;
Pack(3) ;
Pack(5) ;
Loose.
Cette identité doit rester la clé opérationnelle de consommation physique lorsque le moteur l’exige.
8.6 Lot et lieu
Une identité physique peut ensuite être répartie :
sur plusieurs lots ;
dans plusieurs lieux ;
dans plusieurs états de stock.
La hiérarchie conceptuelle est donc :
Cigar ID → Product → SKU → Stock Identity → Lot → Location
Le système doit rendre cette structure compréhensible sans la montrer inutilement à l’utilisateur final.
---
9. Cigar DNA : actif stratégique, pas simple attribut
Le DNA est un système de connaissance et de recommandation.
Il ne doit jamais être réduit à quelques tags sur une fiche produit.
9.1 Doctrine de preuve
Règle zéro invention.
Priorité des sources :
manufacturer / source officielle ;
sources spécialisées reconnues ;
sources secondaires contrôlées.
Une information non prouvée doit rester :
inconnue ;
candidate ;
à vérifier.
9.2 Research Pool
Le système doit préserver ou améliorer :
candidats ;
preuves ;
statut ;
validation ;
déduplication ;
rapprochement avec Cigar Master ;
audit des décisions.
9.3 Strength
Échelle actuelle :
Mild = 1
Mild-Medium = 2
Medium = 3
Medium-Full = 4
Full = 5
Manufacturer prioritaire lorsqu’il classe explicitement son produit ; sinon consensus de sources selon les règles établies.
9.4 Sweetness
La sucrosité est un axe distinct et ne doit pas être déduite d’un simple caractère fruité ou agrumé.
9.5 Recommandation
Pipeline de recommandation à préserver / enrichir :
durée / format → puissance → DNA fit → signatures / spice / sweetness → disponibilité réelle → prix
Le système doit pouvoir recommander 1 à 3 produits réellement disponibles, pas des références théoriques introuvables.
9.6 DNA + CRM
À terme, le DNA client doit apprendre de plusieurs types de signaux :
questionnaire explicite ;
achats ;
produits appréciés ;
refus ;
répétitions ;
notes d’un conseiller ;
contexte d’usage ;
événements.
Chaque signal doit garder son origine et son niveau de confiance.
---
10. Notre réalité stock et opérations
Le stock est déjà un domaine fortement structuré.
Nous devons pouvoir répondre à tout moment :
> **Qu’avons-nous ? D’où cela vient-il ? Où cela se trouve-t-il ? Où cela est-il allé ?**
Le système doit gérer :
stock central ;
plusieurs lieux ;
réservations clients ;
réservations événements ;
sorties événement ;
retours événement ;
dépôts partenaires ;
transit ;
lots ;
provenance ;
réceptions partielles ;
FIFO ;
corrections ;
audit complet.
10.1 Doctrine historique
Nous refusons de fabriquer une précision historique inexistante.
Si un ancien stock est connu mais son emplacement historique n’est pas prouvé :
quantité connue ;
lieu `LEGACY_UNKNOWN`.
Même principe pour la provenance.
Cette prudence est une qualité du système, pas une anomalie à masquer.
---
11. Notre réalité achats, sourcing et import
L’achat est une décision de capital.
Une promotion fournisseur n’est pas automatiquement une opportunité.
Il faut tenir compte de :
prix d’achat ;
format ;
adéquation au marché camerounais ;
disponibilité existante ;
historique de rotation ;
marge ;
landed cost ;
FX ;
fret ;
douane ;
transport ;
cash disponible ;
quantités minimales ;
possibilité de mixer plusieurs SKUs ;
délai fournisseur ;
fréquence des promotions.
11.1 Purchase Watch
Le système doit prévoir un agent/processus capable de :
email promo fournisseur → détection maison/série → ouverture du CTA → extraction des références/SKUs → rapprochement watchlist → calcul économique → recommandation → journalisation
La décision d’achat reste humaine.
11.2 Mémoire des opportunités
Même lorsqu’on n’achète pas, une opportunité positive doit pouvoir être conservée pour apprendre :
fréquence des promotions ;
profondeur de discount ;
saisonnalité ;
fournisseur ;
évolution des prix.
---
12. Notre réalité financière
Le système doit séparer quatre vérités :
vente ≠ encaissement ≠ coût économique ≠ paiement fournisseur
12.1 Vente
Facte commercial.
12.2 Encaissement
Une vente peut être encaissée :
en une fois ;
en plusieurs fois ;
avant ou après livraison selon le cas.
12.3 Coût économique
Le coût d’un lot existe indépendamment du moment où le fournisseur est payé.
12.4 Paiement
Le décaissement est un fait de trésorerie.
Cette distinction doit permettre :
créances ;
cash ;
COGS ;
marge ;
landed cost ;
performance réelle.
---
13. LE CRM : UN CHANTIER CENTRAL
Le CRM doit être traité comme une brique stratégique de premier rang.
Il ne doit pas être un module secondaire greffé aux ventes.
Notre ambition est de construire progressivement une mémoire commerciale et relationnelle de CitiCigars.
13.1 Objet du CRM
Le CRM doit répondre à cinq questions :
Qui est cette personne ou organisation ?
Quelle est notre relation avec elle ?
Que savons-nous de ses goûts, besoins et comportements ?
Que s’est-il passé entre nous ?
Quelle est la prochaine meilleure action ?
13.2 Contact 360
Pour un individu :
identité ;
coordonnées ;
source ;
parrain/referral/introduction ;
entreprise/organisation liée ;
rôle ;
ville ;
préférences de contact ;
consentement / opt-in lorsque requis ;
langues ;
notes ;
tags ;
segments ;
statut client/prospect ;
relation owner/commercial ;
potentiel ;
dates importantes configurables ;
interactions ;
achats ;
encaissements ;
solde ;
événements ;
club ;
cadeaux ;
DNA ;
dernières recommandations ;
dernières relances ;
prochaines actions.
13.3 Account 360
Pour une entreprise ou organisation :
raison sociale ;
type ;
industrie ;
contacts liés ;
décideurs ;
acheteurs ;
influenceurs ;
finance ;
sites/adresses ;
opportunités ;
historique des achats ;
gifting ;
événements ;
devis ;
conditions commerciales ;
créances ;
valeur totale ;
marge ;
fréquence ;
partenaire associé ;
pipeline.
13.4 Lead management
Le CRM doit gérer :
lead ;
source ;
campagne ;
personne d’introduction ;
degré de qualification ;
intérêt ;
occasion ;
budget si connu ;
prochaine action ;
owner ;
date de relance ;
statut.
Les statuts exacts peuvent être proposés par Replit et configurables.
13.5 Pipeline commercial
Prévoir un pipeline flexible, au minimum pour :
B2C important ;
corporate ;
gifting ;
partenariats ;
événements.
Exemples d’étapes configurables :
nouveau ;
contacté ;
qualifié ;
besoin identifié ;
proposition ;
discussion ;
gagné ;
perdu ;
dormant.
Le système doit enregistrer :
dates de passage ;
owner ;
montant potentiel ;
probabilité si utilisée ;
raison de perte ;
prochaine action.
13.6 Activités et mémoire relationnelle
Chaque relation doit pouvoir conserver :
appel ;
WhatsApp ;
email ;
rencontre ;
dégustation ;
recommandation ;
devis ;
promesse ;
relance ;
note ;
tâche ;
événement.
L’objectif n’est pas de surdocumenter mais d’éviter que la relation vive seulement dans la mémoire d’une personne.
13.7 Tâches et follow-up
Le système doit être excellent pour répondre :
> **Qui dois-je relancer aujourd’hui et pourquoi ?**
Prévoir :
tâches ;
échéance ;
responsable ;
priorité ;
snooze ;
résultat ;
prochaine tâche automatique ou proposée ;
alertes intelligentes.
13.8 Segmentation
Segmentation dynamique et cumulable selon :
CA ;
marge ;
récence ;
fréquence ;
panier ;
format ;
puissance ;
DNA ;
maison ;
budget ;
ville ;
canal ;
corporate ;
gifting ;
club ;
événements ;
créance ;
inactivité ;
source d’acquisition.
13.9 Next Best Action
Le CRM doit à terme pouvoir proposer :
relancer ;
ne pas relancer ;
recommander un produit ;
proposer un sampler ;
inviter à un événement ;
proposer le club ;
proposer un cadeau ;
demander un règlement ;
féliciter / remercier ;
réactiver un ancien client.
Toute recommandation doit expliquer les faits qui la justifient.
13.10 Customer lifecycle
Le système doit pouvoir distinguer :
prospect ;
premier achat ;
client actif ;
récurrent ;
VIP ;
inactif ;
à réactiver ;
perdu ;
ambassadeur ;
membre Club.
Aucune catégorie sensible ne doit être inférée.
13.11 Referral / réseau
Le bouche-à-oreille est important.
Prévoir :
introduced_by ;
referred_by ;
relation entre contacts ;
attribution de nouveaux clients ;
performance des introductions ;
possibilité de remercier un apporteur sans transformer cela automatiquement en programme financier.
13.12 CRM B2C et B2B dans un même modèle
Ne pas construire deux silos.
Une personne peut être :
client personnel ;
contact d’une entreprise ;
invité d’un événement ;
membre du club ;
prescripteur ;
acheteur corporate.
Le modèle doit permettre plusieurs rôles simultanés.
---
14. CORPORATE / B2B — À PRÉVOIR DÈS MAINTENANT
Le corporate n’est pas un simple champ `customer_type = company`.
Il faut prévoir un vrai workflow.
14.1 Cas d’usage
gifting de fin d’année ;
cadeaux dirigeants ;
cadeaux clients ;
coffrets VIP ;
commande événementielle ;
activation partenaire ;
commandes récurrentes ;
expériences privées ;
partenariats.
14.2 Account hierarchy
Prévoir :
entreprise ;
groupe ;
filiale ;
département ;
plusieurs contacts ;
plusieurs adresses ;
rôles.
14.3 Opportunity
Une opportunité corporate doit pouvoir contenir :
besoin ;
occasion ;
budget ;
quantité ;
produits envisagés ;
personnalisation ;
date cible ;
contacts ;
décideur ;
statut ;
valeur estimée ;
coûts estimés ;
marge estimée ;
prochaine action.
14.4 Quote / proposition
Prévoir une capacité de devis/proposition :
lignes ;
quantité ;
prix ;
remise ;
options ;
validité ;
version ;
statut ;
acceptation ;
conversion en commande.
14.5 Commande corporate
Prévoir :
plusieurs destinataires ;
plusieurs lieux ;
calendrier de livraison ;
personnalisation ;
notes ;
documents ;
facturation ;
encaissements multiples.
14.6 Corporate analytics
Mesurer :
pipeline ;
conversion ;
CA ;
marge ;
cycle de vente ;
répétition ;
concentration ;
performance par secteur/source/owner.
---
15. CLUB CITICIGARS — CAPACITÉ FUTURE À PRÉVOIR
Le Club doit pouvoir être activé plus tard sans refonte du CRM.
15.1 Membership entity
Prévoir :
membre ;
date d’adhésion ;
statut ;
niveau configurable ;
date de renouvellement ;
source ;
sponsor/parrain éventuel ;
avantages associés ;
historique.
15.2 Benefits engine
Les avantages ne sont pas encore figés.
Construire un modèle configurable, par exemple :
accès événement ;
priorité ;
offre privée ;
contenu réservé ;
allocation limitée ;
service particulier ;
remise éventuelle ;
cadeau éventuel.
Ne figer aucun avantage non décidé.
15.3 Club + CRM
Le club doit enrichir Customer 360 :
événements fréquentés ;
activité ;
engagement ;
renouvellement ;
offres utilisées.
15.4 Club + CMS/PWA
Prévoir :
espace membre ;
contenu privé ;
calendrier ;
invitations ;
historique ;
profil DNA ;
recommandations ;
renouvellement si applicable.
---
16. ÉVÉNEMENTS — PARTICIPANT AUJOURD’HUI, ORGANISATEUR DEMAIN
L’architecture doit gérer plusieurs rôles de CitiCigars :
fournisseur ;
partenaire ;
sponsor ;
exposant ;
animateur ;
juge ;
co-organisateur ;
organisateur.
16.1 Event entity
Prévoir :
nom ;
type ;
date ;
lieu ;
organisateur ;
rôle CitiCigars ;
partenaires ;
sponsors ;
budget ;
statut ;
capacité ;
invitations ;
participants ;
stocks affectés ;
ventes ;
dépenses ;
recettes ;
leads ;
médias ;
résultats.
16.2 Participants
Prévoir :
invité ;
inscrit ;
présent ;
no-show ;
VIP ;
partenaire ;
staff ;
membre Club.
16.3 Jury / évaluation
Si CitiCigars participe comme juge :
catégories ;
participants/produits évalués ;
critères ;
scores ;
notes ;
jury ;
résultats ;
audit.
Le moteur doit rester générique et configurable.
16.4 Event stock
Déjà lié aux capacités Phase 2 :
réservation événement ;
sortie ;
lieu événement ;
consommation ;
retour ;
pertes/corrections.
16.5 Event CRM
Chaque événement doit devenir une source commerciale :
nouveaux leads ;
contacts rencontrés ;
produits goûtés ;
préférences observées ;
follow-up ;
conversion post-event.
16.6 Event P&L
Pour un événement organisé :
recettes ;
sponsoring ;
dépenses ;
stock consommé ;
coût ;
marge ;
valeur commerciale des leads ;
conversion ultérieure.
---
17. PARTENARIATS
Prévoir un domaine relationnel pour :
hôtels ;
lounges ;
restaurants ;
spiritueux ;
agences ;
entreprises ;
lieux.
Pour chaque partenaire :
contacts ;
modèle de partenariat ;
opportunités ;
événements ;
dépôt ;
ventes ;
commissions si applicables ;
stock sur site ;
historique ;
performance ;
documents ;
renouvellement.
Le partenaire peut aussi être un `Account` CRM avec un rôle spécifique.
---
18. CMS / CONTENT STUDIO — À INTÉGRER AU SYSTÈME
CitiCigars dispose déjà d’une infrastructure CMS simple. Le nouveau système doit la préserver ou la faire évoluer sans casser le site.
18.1 Objectif
Permettre à l’équipe de gérer sans développeur :
Accueil ;
Hero ;
blocs commerciaux ;
pages ;
événements ;
promotions ;
gifting ;
B2B ;
contenus éditoriaux ;
CTA ;
images/assets.
18.2 Workflow
Prévoir :
brouillon ;
preview ;
publication ;
activation/désactivation ;
date de début/fin ;
mobile preview ;
desktop preview ;
historique de modification ;
auteur.
18.3 Contenu structuré
Ne pas enfouir toute la logique dans du HTML libre.
Préférer des blocs structurés réutilisables :
hero ;
product spotlight ;
event ;
CTA ;
editorial ;
testimonial si utilisé ;
gifting ;
B2B.
18.4 CMS + commerce
Le CMS doit pouvoir pointer vers :
Cigar ID ;
produit ;
catégorie ;
événement ;
offre ;
page DNA ;
contact/WhatsApp.
18.5 Content Agent
Prévoir un agent capable de :
proposer un draft ;
adapter au canal ;
suggérer des produits disponibles ;
éviter les informations non prouvées ;
citer les données internes utilisées ;
demander approbation avant publication.
---
19. OMNICANAL : SITE, PWA, WHATSAPP ET ADMIN
Une seule vérité métier doit alimenter plusieurs interfaces.
Architecture cible :
CitiCigars Core Services
→ Admin / back-office
→ Site public
→ PWA
→ WhatsApp
→ Agents
→ futures intégrations
19.1 WhatsApp
Prévoir l’intégration comme canal de :
découverte ;
qualification ;
recommandation ;
relance ;
commande assistée ;
suivi ;
événements.
Le système doit pouvoir journaliser une interaction utile dans le CRM sans exiger de copier chaque message.
19.2 PWA
La future PWA doit pouvoir devenir l’expérience mobile privilégiée :
catalogue ;
DNA ;
wishlist ;
recommandations ;
événements ;
club ;
profil ;
commandes ;
contact rapide ;
contenu.
19.3 Admin mobile
Le back-office mobile doit permettre les opérations urgentes :
chercher un produit ;
vérifier stock ;
créer une vente ;
enregistrer un encaissement ;
consulter un client ;
recevoir ;
déplacer ;
réserver ;
relancer.
---
20. MARKETING ET ACQUISITION
Le système doit pouvoir mesurer comment nous sortons du premier cercle.
Prévoir :
source ;
campagne ;
canal ;
code/campagne événement ;
referral ;
landing page ;
contenu ;
partenaire ;
owner.
20.1 Campaign entity
Une campagne peut viser :
acquisition ;
réactivation ;
gifting ;
corporate ;
événement ;
produit ;
club.
20.2 Audience
Créer des audiences dynamiques depuis le CRM, sans dupliquer les contacts.
20.3 Résultats
Mesurer :
contacts ciblés ;
réponses ;
opportunités ;
ventes ;
CA ;
marge ;
nouveaux clients ;
réactivations.
---
21. NOTRE MODÈLE OPÉRATIONNEL
CitiCigars doit pouvoir fonctionner même lorsque le propriétaire n’est pas physiquement à Douala.
Le système doit donc permettre :
délégation ;
permissions ;
audit ;
visibilité distante ;
responsabilisation ;
actions attribuées ;
suivi des exceptions.
Une opération critique ne doit pas dépendre de la mémoire ou de la présence d’une seule personne.
---
22. CE QUI DOIT « FAIRE MAGIQUE »
La magie attendue est de la compréhension et de l’action, pas des animations.
22.1 Ouverture du matin
Le propriétaire ouvre le système et voit par exemple :
ventes hier / cette semaine ;
cash encaissé ;
créances à relancer ;
capital immobilisé ;
produits proches de rupture ;
produits lents ;
PO en retard ;
opportunités d’achat ;
clients à relancer ;
opportunités corporate ;
prochain événement ;
actions recommandées.
Chaque chiffre est cliquable jusqu’à sa preuve.
22.2 Client 360
Ouvrir un client doit permettre de comprendre immédiatement :
valeur ;
solde ;
récence ;
fréquence ;
goûts ;
DNA ;
formats ;
marques ;
historique ;
événements ;
dernière interaction ;
prochaine action ;
produits actuellement disponibles correspondant à son profil.
22.3 Produit 360
Ouvrir un cigare doit permettre de voir :
Cigar ID ;
DNA ;
preuves ;
SKUs ;
stocks ;
lieux ;
lots ;
coût ;
marge ;
prix ;
rotation ;
clients qui l’achètent ;
clients à qui il pourrait convenir ;
PO ouverts ;
opportunités fournisseur.
22.4 Corporate 360
Ouvrir une entreprise doit montrer :
contacts ;
historique ;
opportunités ;
gifting ;
événements ;
commandes ;
encaissements ;
solde ;
marge ;
prochaine action.
22.5 Event 360
Ouvrir un événement doit montrer :
participants ;
partenaires ;
stocks ;
ventes ;
leads ;
dépenses ;
recettes ;
conversion post-event.
---
23. PRINCIPES D’ARCHITECTURE POUR LE FUTUR
Tout doit être prévu dès maintenant, mais tout ne doit pas nécessairement être construit maintenant.
C’est une distinction essentielle.
23.1 Design for future, build by priority
Le modèle de données, les identités, les APIs et l’architecture doivent éviter de bloquer :
corporate ;
club ;
événements ;
CRM avancé ;
WhatsApp ;
marketing ;
CMS ;
PWA ;
agents.
Mais Replit doit proposer une séquence d’exécution pragmatique.
23.2 Modules cohérents, pas monolithe chaotique
Prévoir des domaines clairs :
Cigar Master ;
Product/SKU ;
DNA ;
Inventory ;
Purchasing ;
Sales ;
CRM ;
Cash ;
Costing ;
Corporate ;
Club ;
Events ;
Partners ;
CMS ;
Marketing ;
Analytics ;
Agents.
Ils partagent des identités et services communs.
23.3 Réutiliser les mêmes entités
Éviter les doublons :
un client corporate n’est pas recréé dans Events ;
un membre Club reste le même Contact ;
un partenaire est un Account avec rôle ;
un participant événement peut devenir un Contact/Lead ;
un produit CMS pointe vers le Product Master existant.
23.4 Feature flags / activation progressive
Une capacité future peut exister architecturalement mais rester inactive.
Exemples :
Club ;
Event ticketing ;
membership payment ;
automated messaging ;
advanced campaigns.
---
24. NORTH STAR PRODUIT
Le CitiCigars Commerce Operating System doit devenir :
> **Une seule mémoire opérationnelle de l’entreprise, reliant produit, client, stock, achat, vente, cash, coût, contenu, événement et relation — avec une couche d’intelligence qui explique ce qui se passe et propose la prochaine meilleure action.**
La mission n’est donc pas seulement :
> « enregistrer le commerce ».
Elle est :
> **mieux acheter, mieux connaître, mieux vendre, mieux encaisser, mieux décider et exécuter plus vite que la concurrence.**
---
PARTIE II — SPÉCIFICATION DE BUILD
La partie qui suit conserve la spécification technique et produit déjà définie pour le moteur, l’expérience, les analytics, la finance et les agents. Replit doit la lire à la lumière du contexte ci-dessus.

1. Baseline à préserver
1.1 Phase 2 acceptée
Le staging Phase 2 est techniquement accepté avec :
ledger historique append-only ;
projections stock aggregate / location / lot ;
réconciliation parfaite entre couches ;
provenance explicite ;
`LEGACY_UNKNOWN` pour les faits historiques non démontrables ;
identités physiques exactes `SKU + type + packSize` ;
lieux ;
lots ;
groupes de mouvements ;
allocations ;
FIFO déterministe ;
réservations client ;
réservations événement ;
sorties / retours événement ;
dépôts ;
corrections encadrées ;
achats / fournisseurs / PO ;
réceptions partielles ;
création de lots à réception ;
CRM vente → consommation atomique du stock ;
APIs de traçabilité ;
monitoring ;
triggers d’immutabilité ;
zéro quantité négative sur les contrôles acceptés.
Les migrations de compatibilité et Phase 2 déjà acceptées ne doivent pas être réécrites. Toute évolution DB est forward-only et versionnée après la chaîne existante.
1.2 Doctrine historique
Le système ne doit jamais inventer ce qui n’est pas prouvé.
Un stock historique connu mais dont le lieu n’est pas documenté reste `LEGACY_UNKNOWN`.
Une provenance non documentée reste explicitement inconnue.
Un historique commercial peut être importé comme historique commercial sans prétendre prouver un mouvement physique ancien.
Une correction se fait par contre-écriture / mouvement compensatoire, pas par réécriture silencieuse du passé.
---
2. Le problème à résoudre maintenant
Le moteur est puissant. L’interface actuelle ne l’est pas encore.
Les principaux défauts à corriger sont :
écrans trop techniques ;
vocabulaire interne visible (`onHand`, UUID, groupes techniques, etc.) ;
tableaux longs et peu hiérarchisés ;
drill-down insuffisant ;
alertes de qualité de données pouvant noyer les alertes opérationnelles ;
mouvements affichés comme deltas techniques plutôt que comme opérations métier ;
manque de vision financière complète ;
manque de Customer / Product / Supplier 360 ;
manque de lien immédiat entre indicateur → cause → preuve → action ;
expérience mobile insuffisamment pensée comme une app ;
mélange résiduel français/anglais ;
manque de couche intelligence/action réellement intégrée.
---
3. Principes UX non négociables
3.1 Le patron d’abord
Le système doit être compréhensible par le propriétaire sans connaître le schéma de base de données.
À l’ouverture, en moins de 30 secondes, il doit comprendre :
ce qui s’est passé aujourd’hui ;
ce qui nécessite son attention ;
où est le cash ;
où est le stock ;
ce qui se vend ;
ce qui ne tourne pas ;
ce qui doit être encaissé ;
ce qui doit être acheté ;
ce qui mérite une action.
3.2 Progressive disclosure
Par défaut, montrer le fait métier.
Le détail technique existe mais se révèle seulement lorsque l’utilisateur le demande.
Exemple :
Mise en dépôt — 1 boîte — Store → Partenaire — 26/08
Puis : Voir détails → mouvement groupé → deltas ledger → lot → allocation → UUID.
3.3 Drill-down partout
Tout chiffre important doit être cliquable ou navigable jusqu’à sa preuve.
Exemple :
Stock au coût → Marque → Série → SKU → Identité physique → Lieu → Lot → Réception → PO → Fournisseur.
Ou :
Marge → Vente → Ligne → SKU → Lot FIFO → Réception → coût rendu.
3.4 Pas de chart theater
Aucun graphique ne doit exister uniquement parce qu’il est esthétique.
Chaque visualisation doit répondre à une question et permettre :
filtrer ;
comparer ;
ouvrir le détail ;
agir.
3.5 Français métier complet
Aucun mélange visible FR/EN dans l’interface finale, sauf vocabulaire cigar réellement consacré.
Les termes techniques internes sont masqués par défaut.
3.6 Mobile-first
L’Admin doit être conçu comme une application mobile de gestion, pas comme un desktop réduit.
navigation tactile ;
cartes ;
actions principales accessibles au pouce ;
recherche globale ;
tables adaptatives ;
drill-down plein écran mobile ;
PWA installable ;
formulaires courts ;
smart defaults.
---
4. Architecture informationnelle cible
Replit peut proposer une meilleure hiérarchie, mais l’OMS doit couvrir au minimum les univers suivants :
Accueil / Command Center
Ventes
Clients
Stock
Achats & Réceptions
Trésorerie opérationnelle
Analytics
Intelligence / Actions
Administration / Paramètres
La navigation doit éviter de multiplier les écrans techniques de premier niveau.
---
5. Command Center propriétaire
5.1 Vue Aujourd’hui
Afficher au minimum :
CA net ;
ventes ;
encaissements ;
solde client total ;
marge brute si coût disponible ;
stock disponible ;
valeur du stock au coût ;
valeur de détail théorique ;
PO ouverts ;
réceptions attendues ;
alertes critiques ;
actions proposées.
5.2 Variations
Chaque KPI doit permettre :
aujourd’hui / hier ;
semaine ;
mois ;
période personnalisée ;
comparaison période précédente ;
tendance.
5.3 Centre d’attention
Priorité : actionnabilité.
Ordre recommandé :
anomalie / incohérence critique ;
rupture ;
stock faible ;
client totalement / fortement réservé ;
PO en retard ;
créances en retard ;
stock ancien / dormant à enjeu financier ;
lot ancien ;
opportunité de réapprovisionnement ;
qualité de donnée historique.
Les dizaines d’alertes `LEGACY_UNKNOWN` ne doivent pas noyer le pilotage : agréger en une alerte de qualité de données du type :
« 46 positions historiques ont une provenance ou un lieu non documenté » → drill-down.
---
6. Stock — nouvelle expérience
6.1 Stock Central 2.0
Question à laquelle l’écran doit répondre :
> **Qu’avons-nous réellement, sous quelle forme, où, et dans quel état ?**
Colonnes/éléments métier prioritaires :
produit ;
marque / série / vitole ;
SKU ;
identité : Box / Pack(n) / Loose / Accessory ;
physique ;
disponible maintenant ;
réservé client ;
réservé événement ;
événement ;
dépôt ;
transit ;
lieux ;
âge/provenance ;
alerte ;
dernière activité.
Le produit doit être visuellement dominant ; le SKU est secondaire.
6.2 Stock 360 / fiche produit
Clic sur un produit/identité → page 360 comprenant :
résumé quantités ;
disponibilité par lieu ;
lots ;
provenance fournisseur ;
réceptions ;
réservations ;
dépôts ;
événements ;
ventes récentes ;
vitesse de vente ;
âge ;
coût ;
marge ;
mouvements métier ;
audit technique en dernier niveau ;
recommandations.
6.3 Lieux
Vue carte/table logique :
Store ;
partenaire ;
dépôt ;
événement ;
`LEGACY_UNKNOWN` ;
futurs lieux.
Chaque lieu → positions → produit → lot → mouvement.
6.4 Lots et provenance
Filtres rapides :
provenance documentée ;
provenance historique inconnue ;
vieux lots ≥ seuil ;
fournisseur ;
réception ;
lieu ;
stock restant.
Un même lot réparti sur plusieurs lieux doit être lisible comme un même lot éclaté, pas comme des lignes sans relation apparente.
6.5 Mouvements métier
Affichage par défaut groupé par opération métier :
Réception ;
Vente ;
Réservation client ;
Réservation événement ;
Sortie événement ;
Retour événement ;
Mise en dépôt ;
Retour dépôt ;
Transfert ;
Correction ;
Annulation compensatoire.
Le ledger technique reste accessible dans un accordéon/drawer de preuve.
---
7. Trois dettes Phase 2 à fermer
7.1 Transfert générique entre lieux
Créer un vrai workflow :
Source → Destination → identité → quantité → référence → opérateur → note
avec écriture atomique et traçable.
7.2 Bundle / sampler physique
Formaliser la relation :
bundle commercial ;
composants physiques ;
quantité ;
éventuelle composition/décomposition ;
coût et COGS des composants.
Aucun bundle ne doit provoquer de double comptage.
7.3 Vente CRM — correction / annulation
Pas de DELETE transactionnel.
Créer une opération compensatoire auditable permettant :
annuler tout ou partie d’une vente ;
restaurer les bons lots ;
corriger encaissements associés ;
conserver lien entre original et correction.
---
8. Ventes & CRM 2.0
8.1 Nouvelle vente
La vente doit être rapide et naturelle :
client ;
recherche produit ;
identité physique ;
lieu source ;
quantité ;
prix catalogue ;
promotion/remise ;
prix net ;
encaissement initial ;
moyen de paiement ;
note ;
confirmation.
Le système affiche avant validation :
disponibilité ;
lot FIFO qui sera consommé ;
coût/marge estimés si disponibles ;
solde client après vente.
8.2 Customer 360
Une fiche client doit réunir :
identité/contact ;
CA lifetime ;
marge lifetime ;
récence ;
fréquence ;
panier moyen ;
encaissements ;
balance ;
créances âgées ;
dernières commandes ;
produits/marques/formats préférés ;
DNA cigare si disponible ;
intérêts sourcing ;
interactions ;
événements ;
recommandations de relance ;
messages proposés.
8.3 CRM dérivé du réel
Le CRM se nourrit des transactions et interactions. Éviter la saisie administrative inutile.
---
9. Phase Finance A — Journaux de trésorerie opérationnelle
9.1 Doctrine
Commande ≠ ligne produit ≠ encaissement.
Une vente peut avoir plusieurs encaissements.
Les soldes sont dérivés du journal ; ils ne constituent pas la source de vérité.
9.2 Journal des encaissements
Chaque Receipt doit contenir :
receipt_id ;
date/heure ;
client ;
SALE ID ;
montant ;
devise ;
moyen de paiement ;
caisse / banque / compte ;
référence transaction ;
opérateur ;
note ;
justificatif facultatif ;
statut/reversal linkage.
Formules déterministes :
Encaissé commande = Σ receipts non annulés
Balance = Prix net commande – Encaissé
9.3 Journal des décaissements
Chaque Disbursement doit contenir :
disbursement_id ;
date ;
bénéficiaire/fournisseur ;
montant ;
devise ;
taux de change si pertinent ;
moyen de paiement ;
compte/caisse ;
catégorie ;
PO / réception / facture fournisseur / événement si pertinent ;
référence ;
opérateur ;
note ;
justificatif ;
reversal linkage.
9.4 Trésorerie 360
Vue :
encaissements période ;
décaissements période ;
net cash opérationnel ;
par moyen de paiement ;
par compte/caisse ;
clients à recouvrer ;
fournisseurs payés ;
historique ;
drill-down transaction.
Ce module n’est pas une comptabilité générale complète.
---
10. Phase Finance B — Coût rendu, COGS et marge réelle
10.1 Doctrine
Le cash et le fait économique sont distincts.
Le paiement fournisseur peut précéder ou suivre une réception. Le coût de stock existe indépendamment de la date du paiement.
10.2 Coût rendu d’un arrivage
Supporter au minimum :
prix fournisseur ;
fret ;
assurance ;
douane ;
taxes non récupérables ;
transit ;
transport local ;
manutention ;
autres coûts directement attribuables ;
change.
10.3 Allocation
Prévoir des méthodes déterministes :
quantité ;
valeur ;
poids si disponible ;
volume si disponible ;
manuelle.
L’allocation utilisée doit être conservée et auditable.
10.4 Lot cost
Chaque lot reçu doit pouvoir porter un coût unitaire rendu figé/versionné.
Une vente consomme les lots selon FIFO déjà validé et calcule :
COGS réel = quantité vendue × coût du/des lot(s) consommé(s)
Marge brute = vente nette – COGS
10.5 Analyses marge
marge par marque ;
série ;
SKU ;
vitole ;
client ;
vendeur ;
événement ;
fournisseur ;
PO ;
réception ;
lot ;
période ;
canal.
---
11. Achats & Réceptions 2.0
11.1 Purchasing workspace
Vue principale :
PO ouverts ;
partiellement reçus ;
reçus ;
retard ;
montant ;
fournisseur ;
date attendue ;
quantité commandée/reçue/restante ;
coût prévisionnel ;
coûts additionnels ;
statut paiement fournisseur ;
alertes.
11.2 Supplier 360
achats cumulés ;
fréquence ;
délais ;
retard ;
qualité des réceptions ;
coût moyen ;
évolution prix ;
marge générée ;
sell-through des arrivages ;
stock restant issu du fournisseur ;
PO ouverts ;
paiements ;
contacts ;
notes.
11.3 Réception
Expérience très visuelle :
sélectionner PO ;
voir commandé / reçu / restant ;
saisir réception partielle ;
destination ;
lot généré ;
coûts ;
justificatifs ;
validation.
---
12. Analytics — cockpit de gestion
12.1 Ventes
CA brut/catalogue ;
remises ;
CA net ;
ventes ;
panier moyen ;
quantités ;
clients nouveaux/récurrents ;
top/flop ;
évolution ;
mix produit ;
mix client ;
mix canal.
12.2 Stock & capital
stock physique ;
disponible ;
valeur au coût ;
valeur de détail théorique ;
aging ;
capital immobilisé ;
sell-through ;
rotation ;
days of inventory ;
couverture ;
dormance ;
ruptures ;
low stock ;
surstock ;
vieux lots ;
stock par lieu ;
dépôt ;
événement ;
réservation.
12.3 Clients
CA/marge par client ;
récence ;
fréquence ;
panier moyen ;
LTV opérationnelle ;
balance ;
vieillissement créances ;
concentration du CA ;
segmentation ;
potentiel de relance.
12.4 Fournisseurs / arrivages
coût rendu ;
délai ;
fiabilité ;
sell-through ;
marge ;
stock restant ;
aging ;
rendement du capital par arrivage.
12.5 Drill-down contract
Tout KPI critique doit au minimum supporter :
KPI → dimension → entité → transaction → preuve source.
---
13. Intelligence du capital et recommandations
13.1 Règles avant LLM
Les chiffres et classifications critiques sont déterministes.
Exemples :
rupture ;
low stock ;
couverture ;
dormant ;
vieux lot ;
créance en retard ;
PO en retard ;
réapprovisionnement candidat ;
do-not-reorder ;
transfert suggéré ;
anomalie inventaire ;
client à relancer.
13.2 Insight phare CitiCigars
Le propriétaire doit pouvoir obtenir en une phrase :
> **Combien d’argent est immobilisé dans le stock lent, depuis combien de temps, dans quels produits, et quelles actions sont proposées pour récupérer ce capital.**
13.3 Actions proposées
Le système doit pouvoir proposer :
racheter ;
ne pas racheter ;
transférer ;
mettre en promotion ;
constituer un sampler ;
cibler des clients ;
relancer une créance ;
demander un comptage ;
investiguer une anomalie ;
déplacer vers événement/partenaire ;
préparer un PO brouillon.
Chaque proposition contient :
raison ;
données utilisées ;
niveau de confiance/limites ;
impact attendu si calculable ;
lien vers la preuve ;
action proposée.
---
14. Cigar intelligence spécifique
Sans remettre en cause le moteur horizontal, CitiCigars possède une couche métier propre qu’il faut exploiter.
14.1 Dimensions produit disponibles / à exposer
marque ;
série ;
vitole ;
format ;
dimensions ;
box-pressed ;
strength ;
DNA/arômes ;
sweetness ;
classe/priorité sourcing lorsque disponible ;
Box / Pack / Loose.
14.2 Stock-aware recommendation
Toute recommandation client doit vérifier le stock réel avant de proposer un produit.
Pipeline métier attendu :
durée/format → puissance → DNA fit → signatures/spice/sweetness → disponibilité → prix → 1 à 3 recommandations.
14.3 Customer taste intelligence
Le Customer 360 peut synthétiser, sans inventer :
formats achetés ;
marques ;
forces ;
profils DNA ;
réachat ;
intérêts exprimés ;
produits proposés ;
conversion.
---
15. Architecture agentique
15.1 Principe
L’IA explique, orchestre et propose. Elle n’est jamais la source transactionnelle.
Agents → tools/services autorisés → validations → DB.
15.2 Providers
Créer ou réutiliser une abstraction commune :
OpenAI ;
Anthropic ;
fallback/alternate ;
sélection par coût/latence/capacité/disponibilité.
Capacités minimales :
génération texte ;
structured output ;
tool-call loop ;
vision/extraction si nécessaire ;
journaux de run.
15.3 Agents CitiCigars
Owner Copilot
Questions naturelles sur ventes, cash, stock, clients, achats, marge et risques.
Inventory Agent
Surveille rupture, aging, lots, emplacements, anomalies et transferts.
Purchasing Agent
Analyse stock, rotation, coûts, PO, lead time et marge ; propose rachat/non-rachat.
CRM / Sales Agent
Détecte opportunités de relance, recommandation, réachat, créance ; prépare messages.
Receiving Agent
Aide réception, contrôles, identification, anomalies documentaires.
Supplier Opportunity Agent — extension
Préparer l’architecture permettant ensuite de traiter promotions/newsletters fournisseurs, comparer avec watchlist et économie d’achat. L’activation Gmail/web peut venir après le core.
15.4 Autorisations
READ : lecture/analyse ;
PROPOSE : brouillon/action proposée ;
EXECUTE : mutation seulement si policy l’autorise ;
APPROVAL REQUIRED : actions sensibles.
Jamais d’envoi, achat, ajustement, annulation ou mutation sensible sans règle explicite.
15.5 Journal agentique
Conserver :
utilisateur ;
provider/model ;
version prompt ;
tools ;
inputs structurés utiles ;
résultats ;
action proposée ;
approbation ;
exécution ;
erreurs ;
timestamps ;
usage/coût lorsque disponible.
---
16. Action Center
Créer un écran Actions différent d’un dashboard.
Chaque carte doit pouvoir être :
ignorée ;
snoozée ;
assignée ;
ouverte ;
transformée en action/brouillon ;
marquée résolue avec justification.
Exemples :
« 2 références seront en rupture sous X jours » ;
« 1,8 M XAF immobilisés > 180 jours » ;
« Client X doit 400 000 XAF depuis Y jours » ;
« PO Y en retard de 12 jours » ;
« 5 clients ayant acheté Melanio pourraient être intéressés par… » ;
« Stock partenaire non mouvementé depuis 45 jours ».
---
17. Recherche globale
Une recherche universelle doit permettre de trouver :
client ;
téléphone ;
commande ;
SKU ;
produit ;
marque ;
lot ;
PO ;
réception ;
fournisseur ;
mouvement ;
emplacement ;
référence transaction ;
événement.
Recherche tolérante, rapide, mobile.
---
18. Master Gestion — sortie contrôlée
18.1 Objectif
Retirer progressivement Master Gestion comme outil opérationnel parallèle.
18.2 Import à analyser
Avant abandon définitif, inventorier ce que Master Gestion contient encore que l’OMS ne possède pas :
ventes historiques ;
encaissements historiques ;
balances clients ;
dépenses ;
coûts ;
historique utile à rotation/dormance ;
autres informations commerciales.
18.3 Règle d’import
Importer chaque fait au niveau de preuve réellement disponible.
Exemple : une vente historique prouvée peut alimenter l’historique commercial et la vitesse de vente sans créer artificiellement un lot, un emplacement ou un mouvement physique précis.
18.4 Réconciliation
Produire un rapport :
source ;
lignes importées ;
lignes rejetées ;
mapping ;
total avant/après ;
écarts ;
hypothèses interdites ;
éléments restant manuels.
---
19. Rôles et permissions
Prévoir au minimum :
Owner / Super Admin ;
Admin ;
Sales ;
Stock Operator ;
Purchasing ;
lecture seule / analyste si utile.
Permissions sensibles :
voir coûts ;
voir marges ;
remises ;
ajustements stock ;
annulation vente ;
encaissement/reversal ;
décaissement ;
réception ;
approbation agent ;
export.
Toutes les actions sensibles sont auditées.
---
20. PWA et expérience mobile
20.1 PWA installable
L’Admin CitiCigars doit pouvoir être ajouté à l’écran d’accueil Android et s’ouvrir comme une application.
20.2 Cas d’usage mobile prioritaires
consulter dashboard ;
rechercher un produit ;
voir disponibilité ;
créer vente ;
enregistrer encaissement ;
réceptionner ;
déplacer stock ;
consulter client ;
traiter alertes ;
poser une question au Copilot.
20.3 Connectivité
retries ;
idempotence ;
états de chargement explicites ;
pas de double transaction après reconnect ;
brouillons locaux si pertinent ;
architecture compatible avec offline partiel sans sacrifier la vérité transactionnelle.
---
21. Design system et qualité visuelle
21.1 Ambition
L’Admin ne doit pas ressembler à un outil interne bricolé.
Il doit donner l’impression d’un produit SaaS premium, mature et cohérent, approprié à l’univers CitiCigars.
Replit a une grande liberté créative sur :
layout ;
hiérarchie ;
composants ;
graphiques ;
drawers ;
cards ;
transitions utiles ;
densité ;
navigation ;
responsive.
21.2 Garde-fous
lisibilité avant décoration ;
pas d’animations gratuites ;
contrastes accessibles ;
états vides utiles ;
erreurs compréhensibles ;
skeleton/loading propres ;
dates, montants et XAF formatés ;
terminologie cohérente ;
aucune fuite de codes internes par défaut.
21.3 Owner Visual Gate
Aucun module majeur n’est considéré accepté uniquement parce que les tests passent.
Il existe un gate séparé : Owner Visual Acceptance — Claudel.
---
22. APIs, services et read models
Replit peut créer :
nouvelles APIs de lecture ;
agrégations ;
vues analytiques ;
caches ;
tables/read models dérivés ;
jobs analytiques.
À condition que :
le ledger reste la source de vérité physique ;
les journaux financiers deviennent la source de vérité cash ;
le coût reste déterministe ;
les read models soient reconstructibles ;
aucune mutation critique ne contourne les services métier.
Documenter l’API interne et les contrats utilisés par UI/agents.
---
23. Sécurité, audit et continuité
secrets seulement en variables d’environnement ;
aucune clé dans repo/log/prompt ;
staging et production strictement séparés ;
production interdite pendant le build sauf GO explicite ;
migrations forward-only ;
backup vérifié avant changement staging à risque ;
idempotency keys sur opérations sensibles ;
audit events ;
correlation IDs ;
logs structurés ;
health endpoint ;
export de données ;
procédure backup/restore documentée.
---
24. Critères d’acceptation V1
ID	Critère
C-01	Aucun invariant Phase 2 cassé.
C-02	Aggregate/location/lot se réconcilient à zéro écart.
C-03	Aucun stock négatif involontaire.
C-04	Stock Central 2.0 et Stock 360 permettent le drill-down jusqu’au lot/mouvement.
C-05	Mouvements récents sont groupés métier par défaut avec détails ledger accessibles.
C-06	Transfert générique entre lieux fonctionne atomiquement.
C-07	Annulation/correction vente utilise une contre-écriture auditable.
C-08	Bundle/sampler ne double-compte pas le stock.
C-09	Une commande accepte plusieurs encaissements append-only.
C-10	Balance commande = net – somme encaissements.
C-11	Décaissements sont journalisés et réversibles par contre-écriture.
C-12	Landed cost est déterministe, auditable et attachable aux réceptions/lots.
C-13	Vente calcule COGS via lots FIFO et marge réelle lorsque coût disponible.
C-14	Dashboard propriétaire présente ventes, cash, stock, capital, marge et alertes.
C-15	KPI critiques supportent drill-down jusqu’aux transactions sources.
C-16	Customer 360, Product/Stock 360 et Supplier 360 opérationnels.
C-17	Action Center priorise les alertes sans bruit `LEGACY_UNKNOWN` répétitif.
C-18	Recommandations déterministes montrent inputs + justification.
C-19	Owner Copilot n’invente aucun chiffre et ne parle jamais directement à la DB.
C-20	OpenAI et Anthropic branchables via abstraction commune ; panne d’un provider ne casse pas le core.
C-21	Action sensible agent requiert la permission/approval prévue.
C-22	Interface française cohérente, aucun vocabulaire technique exposé par défaut.
C-23	PWA installable et utilisable sur Android moderne.
C-24	Flux achat → réception → coût → stock → vente → encaissement → analytics passe E2E.
C-25	Flux événement/dépôt → retour → vente est traçable.
C-26	Import Master Gestion respecte le niveau réel de preuve et produit un rapport de réconciliation.
C-27	Backup/restore et déploiement sont reproductibles.
C-28	Owner Visual Acceptance obtenue avant production.
C-29	Production n’a subi aucune mutation avant GO explicite.
C-30	Après cutover, Master Gestion n’est plus requis pour le flux opérationnel couvert.
---
25. Séquence de build
Le planning est une séquence de dépendances, pas une estimation humaine. Replit peut aller vite.
R0 — Audit & Freeze
Contenu
lire repo, handoff Phase 2, migrations et services ;
cartographier l’existant ;
inventorier tables/services/routes ;
identifier ce qui est conservé/refondu/ajouté ;
créer North Star + architecture decision log ;
proposer maquettes/IA/navigation ;
aucune mutation DB irréversible avant validation.
Gate : preuve que Replit comprend les invariants et ne prévoit pas de reconstruire le moteur transactionnel.
R1 — Design System & Admin Shell
Contenu
nouvelle navigation ;
design system ;
recherche globale ;
layout desktop/mobile ;
Command Center skeleton réel ;
composants KPI, tables, drawers, filters, charts, actions.
Gate : Owner Visual Review 1.
R2 — Operations UX
Contenu
Stock Central 2.0 ;
Stock 360 ;
lieux ;
lots ;
mouvements groupés ;
Purchasing 2.0 ;
CRM/Sales 2.0 ;
Customer 360 ;
Supplier 360 ;
transfert générique ;
correction vente ;
bundle/sampler.
Gate : parcours métier Phase 2 complet sans perte de traçabilité.
R3 — Cash Journals
Contenu
encaissements ;
paiements partiels ;
reversals ;
décaissements ;
Cash 360 ;
créances ;
liens vente/PO/fournisseur.
Gate : plusieurs encaissements sur une commande + balance correcte + audit.
R4 — Landed Cost & Margin
Contenu
coût rendu ;
frais ;
allocations ;
lot cost ;
COGS FIFO ;
marge réelle ;
supplier/arrival economics.
Gate : fixture économique complète réconciliée manuellement.
R5 — Analytics & Decision Engine
Contenu
dashboards ;
drill-down ;
capital immobilisé ;
aging ;
rotation ;
sell-through ;
receivables ;
recommandations déterministes ;
Action Center.
Gate : chaque KPI majeur traçable jusqu’aux faits sources.
R6 — Agent Layer
Contenu
provider abstraction ;
OpenAI + Anthropic ;
tools READ/PROPOSE/EXECUTE ;
approvals ;
AgentRun ;
Owner Copilot ;
Inventory/Purchasing/CRM agents.
Gate : aucun accès DB direct ; chiffres déterministes ; actions sensibles approuvées.
R7 — Master Migration, PWA & Hardening
Contenu
audit/import Master Gestion ;
PWA ;
performance ;
low-connectivity resilience ;
sécurité ;
exports ;
backup/restore ;
documentation ;
tests E2E ;
staging candidate ;
owner visual sign-off ;
runbook production.
Gate : C-01 à C-30 PASS et GO propriétaire avant production.
---
26. Définition of Done par milestone
Chaque milestone doit inclure :
code implémenté ;
lint/typecheck/build propres ;
tests automatisés ;
scénario manuel ;
capture/preuve visuelle pour UI ;
contrôles DB/invariants pertinents ;
commit Git ;
documentation de continuité mise à jour ;
aucun secret commité ;
compte rendu structuré.
Format obligatoire :
DONE  
WHAT ACTUALLY WORKS  
VISUAL / FUNCTIONAL PROOF  
TESTS  
DB / INVARIANT GATES  
INCOMPLETE  
BLOCKERS  
LAST COMMIT  
NEXT PROPOSED ACTION
---
27. Fichiers de continuité obligatoires
Créer/maintenir, sans supprimer les handoffs existants :
`CTCG_OMS_NORTH_STAR.md`
`CURRENT_STATE.md`
`BUILD_LOG.md`
`KNOWN_ISSUES.md`
`NEXT_ACTIONS.md`
`TEST_STATUS.md`
`ARCHITECTURE_DECISIONS.md`
`DATA_DICTIONARY.md`
`UI_ACCEPTANCE.md`
`PRODUCTION_CUTOVER_RUNBOOK.md`
Le `PHASE2_STOCK_TRACEABILITY_HANDOFF.md` reste une pièce d’audit historique et ne doit pas être écrasé.
---
28. DO NOT — garde-fous
Replit ne doit pas :
reconstruire silencieusement le ledger ;
convertir les projections en source de vérité ;
faire écrire le frontend directement en DB ;
faire écrire un agent directement en DB ;
utiliser le LLM pour calculer stock, coût, balance ou marge ;
inventer des faits historiques ;
masquer `LEGACY_UNKNOWN` en lui attribuant un lieu/provenance fictifs ;
faire des UPDATE/DELETE destructifs sur les journaux ;
modifier les migrations Phase 2 acceptées ;
toucher production pendant le build ;
transformer un dashboard en collection de graphiques non actionnables ;
exposer UUID/terminologie interne comme information principale ;
garder une interface FR/EN mélangée ;
créer une dépendance runtime propriétaire Replit sans alternative portable ;
déclarer un milestone Done sans tests réels et preuve visuelle lorsqu’il y a UI.
No silent redesign
Si Replit estime qu’un principe doit changer, il doit :
décrire le problème ;
proposer l’alternative ;
expliquer l’impact sur les invariants ;
attendre l’arbitrage avant mutation irréversible.
---
29. Liberté créative explicitement accordée à Replit
L’objectif est de nous épater, pas seulement de satisfaire une checklist.
Replit est encouragé à proposer :
meilleures visualisations ;
navigation plus élégante ;
interactions plus rapides ;
drill-down innovants ;
vues comparatives ;
timelines ;
funnels ;
cohorts ;
cartes de capital ;
smart tables ;
command palette ;
recherche universelle ;
micro-interactions utiles ;
storytelling analytique ;
actions contextuelles ;
mobile UX de niveau app.
À condition que l’esthétique serve la compréhension et la décision.
---
30. Questions que Replit doit challenger avant de coder
Replit doit revenir avec une courte revue architecturale sur :
Quelles parties du frontend actuel vaut-il mieux jeter plutôt que refactorer ?
Quels services transactionnels Phase 2 peuvent être réutilisés tels quels ?
Quels endpoints/read models manquent pour une excellente UX ?
Quelle architecture de dashboard/drill-down évite des requêtes lentes ?
Comment modéliser Cash Journals sans perturber `orders` historiques ?
Comment introduire landed cost et COGS sans réécrire la vérité historique ?
Quel modèle de bundle/sampler est le plus sûr ?
Quelle stratégie de reversal protège le ledger ?
Quelle stratégie PWA/low-connectivity est réaliste sans casser l’atomicité ?
Comment architecturer Owner Copilot pour que chaque chiffre soit sourcé par un tool déterministe ?
Quelles données de Master Gestion peuvent être importées comme faits commerciaux sans créer de faux faits stock ?
Quel plan de migration permet de retirer Master Gestion sans big bang ?
---
Annexe A — Prompt d’exécution Replit
Tu construis la V1.0 productisée du CitiCigars OMS décrite dans le cahier des charges joint.
Le système possède déjà un moteur transactionnel de stock Phase 2 techniquement accepté sur staging. Ne le reconstruis pas silencieusement. Ton mandat est de transformer ce moteur en un produit exceptionnel : admin premium, mobile-first, drill-down, vérité cash, coût rendu, marge réelle, intelligence du capital et agents encadrés.
Avant de coder
Lis intégralement ce cahier des charges.
Lis `PHASE2_STOCK_TRACEABILITY_HANDOFF.md` et les migrations/services Phase 2.
Cartographie l’architecture existante.
Produis un plan R0–R7 en indiquant pour chaque partie : KEEP / REFACTOR / REBUILD UI / EXTEND / NEW.
Challenge les 12 questions de la section 30.
Signale toute divergence nécessaire avant de modifier un invariant ou le schéma.
Ne touche jamais la production.
Pendant le build
GitHub/repo est la source de vérité.
Toute migration est forward-only et auditable.
Les migrations Phase 2 acceptées restent inchangées.
Frontend et agents passent par services/APIs ; jamais accès direct DB.
Ledger physique, journaux cash et calculs de coût/marge restent déterministes.
Aucun fait historique n’est inventé.
Commit après chaque milestone substantiel.
Exécute tests et gates avant de déclarer Done.
Mets à jour les fichiers de continuité à chaque milestone.
N’expose pas les secrets.
N’utilise aucun service Replit propriétaire indispensable au runtime sans alternative portable.
Optimise d’abord l’expérience du propriétaire et de l’opérateur, pas la beauté du code pour elle-même.
Tu as une grande liberté créative sur le design et l’UX : nous voulons être impressionnés.
Compte rendu obligatoire après chaque milestone
DONE  
WHAT ACTUALLY WORKS  
VISUAL / FUNCTIONAL PROOF  
TESTS  
DB / INVARIANT GATES  
INCOMPLETE  
BLOCKERS  
LAST COMMIT  
NEXT PROPOSED ACTION
Règle de vitesse
N’étale pas artificiellement ce chantier sur un planning humain. Exécute aussi vite que l’IA le permet, mais la vitesse ne donne jamais le droit de sacrifier les invariants, l’auditabilité ou la qualité du produit.
Critère final de réussite
CitiCigars doit pouvoir abandonner progressivement Master Gestion et utiliser l’OMS comme système opérationnel central.
Le propriétaire doit pouvoir ouvrir l’application sur mobile ou desktop et, sans connaître le schéma interne :
comprendre l’état du commerce ;
vendre ;
encaisser ;
acheter ;
recevoir ;
tracer le stock ;
connaître son coût et sa marge ;
savoir où son capital est immobilisé ;
suivre ses clients ;
voir ce qui nécessite une action ;
poser des questions au Copilot ;
remonter de chaque insight jusqu’au fait source.
Le résultat attendu n’est pas un “admin panel amélioré”. C’est le système d’exploitation quotidien de CitiCigars.


EXTENSIONS OBLIGATOIRES À AJOUTER À LA SPÉCIFICATION TECHNIQUE EXISTANTE
Les domaines suivants font désormais partie du périmètre architectural obligatoire. Ils peuvent être phasés, mais leur existence future ne doit pas exiger une refonte fondamentale.
---
X1. CRM OPERATING SYSTEM
Le CRM devient un domaine de premier rang.
X1.1 Entités minimales
Prévoir au minimum :
`contacts`
`accounts`
`account_contacts`
`leads`
`opportunities`
`pipeline_stages`
`activities`
`tasks`
`segments`
`contact_segments`
`relationships/referrals`
`campaigns`
`campaign_members`
`communication_preferences`
Les noms exacts peuvent différer après audit du schéma existant.
X1.2 Contact/Account 360
Les écrans 360 doivent agréger les faits sans dupliquer les sources :
transactions ;
stock si pertinent ;
encaissements ;
DNA ;
interactions ;
opportunités ;
événements ;
club ;
corporate ;
campagnes.
X1.3 Follow-up engine
Construire une vraie file de relance :
due today ;
overdue ;
high-value ;
dormant ;
new lead ;
post-event ;
unpaid balance ;
opportunity waiting.
Les règles déterministes doivent précéder l’IA.
X1.4 Next-best-action
L’IA peut proposer, mais doit montrer :
faits utilisés ;
niveau de confiance ;
action ;
raison ;
éventuel brouillon de message.
Aucune action externe irréversible sans politique d’approbation explicite.
---
X2. CIGAR MASTER / CIGAR ID GOVERNANCE
X2.1 Canonical identity
Préserver `CTGxxxxxx` comme identifiant canonique du cigare.
X2.2 Anti-duplication
Prévoir :
détection de doublon ;
merge contrôlé ;
alias ;
historique ;
audit ;
interdiction de supprimer silencieusement un ID ayant de l’historique.
X2.3 Product linking
Chaque SKU cigar doit idéalement pointer vers un Cigar ID lorsqu’il représente un cigare canonique.
Bundles/samplers pointent vers leurs composants.
---
X3. PRODUCT / SKU / PACKAGING MASTER
Prévoir une gouvernance claire de :
produit ;
SKU ;
type ;
packSize ;
prix ;
statut ;
canal ;
fournisseur mapping ;
barcode éventuel ;
contenu de bundle ;
publication.
Ne jamais reconstruire le stock à partir d’un champ marketing.
---
X4. DNA INTELLIGENCE & CURATOR
X4.1 Curator workspace
Prévoir une interface moderne :
Research Pool ;
candidats ;
preuves ;
statut ;
comparaison ;
validation ;
déduplication ;
publication.
X4.2 Evidence-first
Toute valeur sensible du DNA doit permettre de remonter à :
source ;
citation/extrait ;
date ;
statut de validation.
X4.3 DNA Agent
Capacités :
rechercher ;
proposer enrichissement ;
repérer conflit ;
détecter doublon ;
préparer recommandation de fusion ;
demander validation humaine.
Aucune preuve ne doit être inventée.
---
X5. PURCHASE WATCH & SUPPLIER INTELLIGENCE
Créer un workspace où apparaissent :
promotions détectées ;
fournisseur ;
date ;
SKU/mapping ;
prix ;
remise ;
stock actuel ;
ventes ;
rotation ;
landed estimate ;
marge estimée ;
priorité ;
décision ;
motif ;
historique de promotions similaires.
L’agent propose. L’humain décide.
---
X6. CORPORATE / B2B
X6.1 Opportunity workspace
Prévoir :
pipeline corporate ;
compte ;
contacts ;
valeur ;
quantité ;
occasion ;
date cible ;
probabilité facultative ;
prochaine action.
X6.2 Quotes
Architecture permettant devis versionnés et conversion en commande.
X6.3 Corporate gifting
Prévoir :
campagne ;
nombre de destinataires ;
niveaux/coffrets ;
personnalisation ;
adresses ;
livraison ;
suivi.
---
X7. CLUB
Prévoir les tables/services nécessaires à :
membership ;
tiers configurables ;
benefits ;
renewals ;
invitations ;
private content ;
member events.
Le module peut être feature-flagged jusqu’à activation.
---
X8. EVENTS
Prévoir :
events ;
event_roles ;
venues ;
partners ;
attendees ;
invitations ;
judges/judging lorsque nécessaire ;
inventory links ;
sales links ;
expenses/revenue ;
leads ;
follow-up.
Le même modèle doit fonctionner pour :
participation ;
partenariat ;
jugement ;
co-organisation ;
organisation.
---
X9. CMS / CONTENT STUDIO
Le nouvel Admin doit intégrer ou moderniser le CMS existant.
Prévoir :
content blocks ;
pages ;
assets ;
drafts ;
publication ;
scheduling ;
preview ;
links vers produits/events/DNA/B2B ;
audit.
L’outil ne doit pas nécessiter un développeur pour une mise à jour normale du site.
---
X10. MARKETING / CAMPAIGNS
Prévoir :
campaign ;
source ;
audience ;
channel ;
start/end ;
content ;
attribution ;
results.
Pas d’envoi automatisé massif sans gestion des permissions/consentements appropriés.
---
X11. PARTNERSHIP MANAGEMENT
Un Account peut porter un rôle partenaire.
Prévoir :
type de partenariat ;
contacts ;
dates ;
opérations ;
événements ;
stock en dépôt ;
performance ;
documents ;
prochaines actions.
---
X12. AGENTS CITICIGARS — CATALOGUE CIBLE
L’architecture agentique doit pouvoir accueillir au minimum :
Owner Copilot
synthèse ;
questions en langage naturel ;
explication ;
décisions.
CRM / Follow-up Agent
relances ;
next-best-action ;
segmentation ;
réactivation ;
préparation message.
Client Advisor / DNA Agent
recommandation stock-aware ;
alternatives ;
explication du fit.
Inventory Agent
rupture ;
faible ;
dormant ;
transfert ;
anomalie.
Purchasing Agent
quoi racheter ;
quoi ne pas racheter ;
quantités ;
timing.
Purchase Watch Agent
promotions fournisseur ;
extraction ;
matching ;
economics ;
mémoire.
Receiving Agent
réception ;
contrôle ;
écarts ;
lot/provenance.
DNA Curator Agent
research ;
evidence ;
doublons ;
conflits.
Corporate Agent
opportunités ;
comptes à relancer ;
gifting ;
préparation proposition.
Event Agent
préparation ;
participants ;
stocks ;
follow-up ;
bilan.
Content Agent
drafts ;
contenus ;
adaptation canal ;
validation des claims.
Data Quality Agent
incohérences ;
champs manquants ;
mapping ;
exceptions à investiguer.
Les agents doivent utiliser des tools/services contrôlés, pas la DB directement.
---
ADDENDUM — LIBERTÉ CRÉATIVE REPLIT
Replit doit challenger l’architecture d’expérience avant de reconstruire les écrans.
Nous attendons de Replit qu’il propose, lorsque cela améliore réellement le produit :
information architecture ;
navigation ;
command palette ;
global search ;
dashboards ;
cards ;
smart tables ;
timelines ;
relationship maps ;
cohorts ;
heatmaps ;
capital maps ;
funnels ;
pipeline views ;
mobile flows ;
drill-down interactions ;
inline actions ;
context panels ;
explainability panels pour agents.
Le design doit être premium, mais la priorité reste :
> **comprendre → décider → agir.**
Une interface spectaculaire qui ralentit une vente, une réception ou une relance est un échec.
---
ADDENDUM — EXIGENCE DE CHALLENGE AVANT BUILD
Avant tout développement majeur, Replit doit remettre un Architecture & Product Challenge Memo comprenant :
compréhension de CitiCigars en 10 à 20 points ;
forces du système actuel ;
limites UX actuelles ;
architecture proposée ;
domaines/modules ;
navigation proposée ;
modèle CRM proposé ;
modèle Cigar ID / Product / SKU ;
intégration DNA ;
corporate/club/events future-proofing ;
architecture CMS ;
analytics et drill-down strategy ;
agent strategy ;
décisions à préserver ;
risques ;
éléments du cahier qu’il challengerait et pourquoi ;
phasage proposé ;
démonstration de ce qu’il compte faire pour nous « épater ».
Ne pas coder une refonte majeure avant que ce memo ne soit discuté et validé.
---
CRITÈRE DE SUCCÈS FINAL
Le système doit pouvoir faire dire au propriétaire :
> **« Je comprends mieux mon commerce en ouvrant CitiCigars que je ne le comprends aujourd’hui en combinant Excel, WhatsApp, ma mémoire, le CRM, le stock et les différents outils. »**
Et à l’opérateur :
> **« Le système m’aide à travailler ; il ne m’oblige pas à travailler pour lui. »**
Et au commercial :
> **« Je sais qui relancer, pourquoi, quand et quoi lui proposer. »**
Et à CitiCigars :
> **« Nous achetons mieux, nous vendons mieux, nous connaissons mieux nos clients et nous exécutons mieux que la concurrence. »**
