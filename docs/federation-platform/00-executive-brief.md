# Synthèse exécutive

## Problème

TabT reste une solution fonctionnelle et riche, mais son exploitation repose sur une architecture, des contrats et une gouvernance devenus difficiles à faire évoluer.

Les API AFTT et VTTL répondent encore en août 2026 et annoncent la version `0.7.29`, datée du 27 novembre 2022. Le dépôt public `gfrenoy/TabT-API` n'a toutefois plus reçu de commit depuis décembre 2020 et ne publie ni release reproductible ni image de déploiement correspondant à la production.

Cette situation crée plusieurs risques :

- dépendance à un nombre limité de personnes connaissant le système ;
- logique métier implicite ou dispersée ;
- difficulté à tester les modifications réglementaires ;
- dépendance SOAP de BePing et des intégrations tierces ;
- absence de trajectoire de reprise documentée ;
- difficulté à proposer une expérience mobile et offline cohérente ;
- dette de sécurité et de conformité à auditer.

## Opportunité

BePing possède déjà :

- une audience et une marque reconnues dans le tennis de table belge ;
- une application mobile en production ;
- un contrat REST indépendant de l'interface SOAP brute ;
- un importateur, un cache, une base PostgreSQL et des notifications ;
- les premiers parcours « capitaine » ;
- une connaissance empirique des limites et exceptions de TabT.

Ces actifs permettent de proposer une transition progressive plutôt qu'une réécriture théorique.

## Produit proposé

**BePing Federation** est une plateforme B2B destinée aux fédérations, ailes, provinces et associations de tennis de table.

Elle couvre progressivement :

1. les référentiels fédéraux et les affiliations ;
2. la configuration des compétitions ;
3. les calendriers, équipes et sélections ;
4. les feuilles de match et leur validation ;
5. les classements et règles sportives ;
6. les tournois et inscriptions ;
7. la publication, les API et les notifications ;
8. l'administration, les contrôles, amendes et litiges.

La même plateforme doit être configurable par fédération, province, saison, catégorie et système de rencontre.

## Ce qui est vendu

Le produit n'est pas « une nouvelle interface pour les résultats ». La proposition commerciale porte sur :

- la continuité opérationnelle ;
- la maîtrise et la réversibilité des données ;
- la réduction de la charge administrative ;
- la suppression des doubles encodages ;
- la traçabilité des décisions sportives ;
- la sécurité et la conformité ;
- une API stable pour l'écosystème ;
- un plan de migration sans interruption de saison.

## Stratégie de livraison

### Étape 1 — Parité de lecture

Créer un modèle canonique indépendant et vérifier qu'il peut reproduire les données publiques, calendriers et classements exposés par TabT.

### Étape 2 — Premier workflow officiel

Gérer une feuille de match complète dans BePing Federation, puis exporter le résultat validé vers TabT.

### Étape 3 — Province pilote

Configurer et exploiter une compétition réelle en double fonctionnement, avec réconciliation automatisée.

### Étape 4 — Source de vérité

Basculer progressivement les domaines officiellement validés, tout en maintenant les anciens contrats pendant une période convenue.

## Conditions de réussite

- sponsor identifié au sein de la fédération ;
- référent métier disponible chaque semaine ;
- accès à un export complet ou à une copie anonymisée de la base ;
- corpus réglementaire versionné ;
- environnement de test TabT ;
- province et compétition pilotes choisies ;
- accord sur les responsabilités RGPD et la propriété des données ;
- critères de parité et décision de bascule signés avant le développement des écritures officielles.

## Estimation de haut niveau

| Phase | Ordre de grandeur | Résultat |
| --- | ---: | --- |
| Découverte et extraction métier | 4 à 6 semaines | Cartographie validée et corpus de tests |
| Socle et parité de lecture | 8 à 12 semaines | Base canonique et API indépendante en lecture |
| Pilote interclubs | 12 à 20 semaines | Workflow officiel en double fonctionnement |
| Produit fédéral initial | 9 à 15 mois | Source de vérité exploitable sur le périmètre convenu |

Ces durées supposent une équipe réduite expérimentée, un référent métier réactif et l'accès aux données nécessaires. Elles devront être recalculées après la découverte.

## Décision recommandée

Autoriser une phase de découverte payante et limitée dans le temps, avec un livrable exploitable indépendamment de la suite du projet.

Le premier engagement commercial ne doit pas promettre la suppression immédiate de TabT. Il doit promettre une preuve de parité, une trajectoire de continuité et un pilote réversible.

