# Produit et proposition commerciale

## Positionnement

BePing Federation est une infrastructure sportive fédérale spécialisée dans les compétitions de tennis de table.

Le produit se place entre :

- les outils génériques de gestion d'adhérents, insuffisants pour les règles sportives belges ;
- les logiciels de tournoi, qui ne couvrent pas l'interclubs fédéral complet ;
- les systèmes historiques sur mesure, riches fonctionnellement mais difficiles à maintenir.

Le différenciateur n'est pas uniquement technologique : il réside dans la combinaison du moteur réglementaire, de la connaissance du ping belge, de l'écosystème BePing et d'une migration sans interruption.

## Acheteurs et utilisateurs

| Acteur | Besoin principal | Valeur proposée |
| --- | --- | --- |
| Fédération / aile | Fiabilité, gouvernance, règles nationales | Source de vérité auditable et réversible |
| Province | Exploitation quotidienne des compétitions | Automatisation et traitement des exceptions |
| Club | Réduction des démarches et erreurs | Portail unique et données préremplies |
| Capitaine | Disponibilités, composition, feuille de match | Parcours mobile et offline |
| Joueur | Résultats, calendrier et progression | Publication rapide via BePing |
| Partenaire / développeur | Données stables et documentées | API versionnée et gouvernée |

## Proposition de valeur

### Pour la direction fédérale

- continuité d'activité documentée ;
- suppression de la dépendance à un serveur ou développeur unique ;
- données exportables et restaurables ;
- coûts d'évolution prévisibles ;
- reporting et journal d'audit.

### Pour les responsables sportifs

- règles configurables par saison ;
- contrôles automatiques avant publication ;
- traitement formalisé des litiges ;
- suppression des corrections silencieuses ;
- recalcul reproductible des classements.

### Pour les clubs

- moins de formulaires et de doubles encodages ;
- calendrier et compositions centralisés ;
- confirmation bilatérale des feuilles ;
- notifications actionnables ;
- historique des décisions.

## Offre commerciale proposée

### 1. Audit et découverte

Mission forfaitaire comprenant :

- inventaire des processus et systèmes ;
- cartographie des données ;
- matrice des règles par compétition ;
- analyse de migration et de sécurité ;
- prototype de parité sur un sous-ensemble ;
- chiffrage et contrat de pilote.

Le livrable doit rester utile même si la fédération décide de ne pas poursuivre.

### 2. Pilote encadré

- une province ou compétition ;
- nombre limité de clubs et de systèmes de rencontre ;
- double fonctionnement avec TabT ;
- formation et support renforcés ;
- bilan de saison et décision de généralisation.

### 3. Abonnement fédéral

Composantes possibles :

- licence annuelle de la plateforme ;
- hébergement et supervision ;
- maintenance corrective et de sécurité ;
- enveloppe d'évolutions réglementaires ;
- support fédéral/provincial ;
- plan de continuité et tests de restauration ;
- option de support club.

### 4. Migration et services

- reprise et nettoyage des données ;
- développement de connecteurs ;
- configuration des règles ;
- formation ;
- accompagnement au changement ;
- import d'historiques additionnels.

## Modèle économique

Le modèle recommandé est B2B : frais de mise en place, abonnement annuel et services encadrés.

Une tarification par fédération ou périmètre administré est préférable à une facturation purement par joueur. Les utilisateurs publics peuvent continuer à accéder gratuitement aux résultats via BePing.

Le contrat doit préciser :

- la propriété des données ;
- les formats et délais de restitution ;
- les niveaux de service ;
- les responsabilités de sécurité ;
- les délais de correction ;
- la gouvernance des évolutions réglementaires ;
- la procédure de sortie et de réversibilité.

## Argumentaire de vente

### Message principal

> Moderniser le système fédéral sans interrompre les compétitions ni perdre l'historique.

### Preuves attendues

- démonstration avec les données de la fédération ;
- parité calculée sur des saisons historiques ;
- résultat encodé et publié de bout en bout ;
- tableau des divergences expliqué ;
- restauration démontrée ;
- export complet remis à la fédération ;
- métriques de disponibilité et de performance.

### Objections prévisibles

| Objection | Réponse attendue |
| --- | --- |
| « TabT fonctionne encore » | Le projet organise la continuité et la transmission, pas une urgence artificielle. |
| « Une migration est trop risquée » | Double fonctionnement, réconciliation et bascule domaine par domaine. |
| « Nous allons perdre l'historique » | Import contrôlé, rapports de comptage, checksums et conservation des identifiants externes. |
| « Les règles sont trop particulières » | Règles versionnées, fixtures historiques et validation par les responsables métier. |
| « Nous dépendrons de BePing » | Données exportables, documentation, dépôts convenus et clauses de réversibilité. |
| « Les clubs ne voudront pas changer » | Parcours mobile simple, pilote limité et compatibilité temporaire avec les habitudes existantes. |

## Risques commerciaux

- cycles de décision fédéraux longs ;
- budget fragmenté entre entités ;
- résistance au changement ;
- règles détenues oralement par quelques responsables ;
- attentes de parité totale avant tout financement ;
- confusion entre logiciel fédéral officiel et application BePing grand public.

La phase de découverte doit donc être vendue comme un projet autonome, avec un sponsor et un comité de décision restreint.

## Gouvernance proposée

- comité de pilotage mensuel ;
- atelier métier hebdomadaire pendant la découverte et le pilote ;
- propriétaire métier unique par domaine ;
- décisions réglementaires consignées dans le dépôt ;
- démonstration toutes les deux semaines ;
- aucune règle critique acceptée uniquement par échange oral ;
- revue de sécurité et de protection des données avant le pilote réel.

