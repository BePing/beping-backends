# BePing Federation — dossier de cadrage

Statut : cadrage initial  
Date de référence : 8 août 2026  
Porteur : Florent Cardoen / BePing

## Objet

Ce dossier cadre la création d'une plateforme fédérale moderne capable de remplacer progressivement TabT comme source de vérité pour les compétitions de tennis de table.

Le projet ne consiste pas à réécrire TabT écran par écran. Il vise à :

- rendre les règles métier explicites, versionnées et testables ;
- préserver les données et identifiants historiques ;
- offrir des parcours modernes aux fédérations, provinces, clubs et capitaines ;
- conserver les contrats REST consommés par BePing pendant la migration ;
- supprimer progressivement la dépendance opérationnelle à l'API SOAP TabT ;
- garantir la traçabilité, la sécurité, la réversibilité et l'autonomie de la fédération.

## Décision structurante

`tabt-rest` reste aujourd'hui une couche de traduction et de résilience au-dessus de TabT. Il ne constitue pas encore une alternative à la source de vérité fédérale.

La trajectoire cible est :

1. `tabt-rest` lit TabT et les sources AFTT/VTTL actuelles ;
2. une base canonique PostgreSQL devient le modèle de lecture privilégié ;
3. les nouveaux workflows écrivent dans BePing Federation et sont répliqués vers TabT ;
4. BePing Federation devient la source de vérité ;
5. l'adaptateur SOAP est conservé temporairement pour les anciens consommateurs, puis retiré.

## Livrables du dossier

| Document | Finalité |
| --- | --- |
| [Synthèse exécutive](./00-executive-brief.md) | Décision, proposition de valeur, périmètre et trajectoire |
| [Produit et proposition commerciale](./01-product-and-commercial.md) | Positionnement, acheteurs, offre, modèle économique et argumentaire |
| [Cartographie métier](./02-domain-map.md) | Domaines, entités, workflows et règles à extraire |
| [Architecture cible](./03-target-architecture.md) | Conception technique, sécurité, exploitation et migration |
| [Backlog du pilote](./04-pilot-backlog.md) | Épics, priorités, critères d'acceptation et jalons |
| [Découverte et parité](./05-discovery-and-parity.md) | Sources de vérité, questions ouvertes, golden masters et gouvernance des décisions |

## Principes non négociables

- Pas de bascule « big bang ».
- Pas de règle fédérale critique uniquement codée dans une condition technique.
- Toute règle dépendant d'une saison doit être historisée et reproductible.
- Toute mutation métier officielle doit être auditable.
- Toute intégration doit être idempotente et rejouable.
- Les données appartiennent à la fédération et restent exportables.
- Les parcours critiques doivent fonctionner sur une connexion instable.
- L'application mobile BePing ne doit pas supporter la complexité de la migration.
- Les traitements publics et administratifs doivent être séparés selon le principe de minimisation des données.

## Résultat attendu du pilote

Une province pilote doit pouvoir gérer une compétition interclubs de bout en bout : configuration, calendrier, composition, feuille de match, confirmation, contrôle, publication et classement.

Pendant le pilote, TabT reste exploitable et reçoit les résultats validés. Le nouveau moteur doit expliquer automatiquement chaque différence entre ses calculs et ceux de TabT.

