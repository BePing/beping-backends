# Cartographie métier

## Objectif

Cette cartographie décrit le métier à reconstruire, indépendamment des écrans et tables historiques de TabT.

Elle sert à :

- attribuer un propriétaire métier à chaque domaine ;
- identifier les règles à confirmer ;
- définir les frontières du pilote ;
- construire un modèle canonique ;
- empêcher la copie involontaire de contraintes techniques historiques.

Les règles ci-dessous sont un inventaire de découverte. Elles ne deviennent officielles qu'après validation par la fédération et ajout d'exemples exécutables.

## Contextes métier

| Contexte | Responsabilité | Concepts principaux | Priorité pilote |
| --- | --- | --- | --- |
| Organisation | Structure fédérale et délégations | Fédération, aile, province, club, local, responsable | P0 |
| Identité et affiliation | Identité sportive et appartenance | Personne, licence, affiliation, statut, catégorie, transfert | P0 en lecture |
| Saisons et référentiels | Valeurs applicables dans le temps | Saison, langue, niveau, catégorie, classement | P0 |
| Compétitions | Définition d'une compétition | Compétition, phase, division, série, règlement | P0 |
| Systèmes de rencontre | Structure des rencontres | Simple, double, ordre de jeu, sets, points | P0 |
| Équipes et éligibilité | Inscription et composition | Équipe, liste de force, noyau, capitaine, éligibilité | P0 |
| Calendrier | Planification officielle | Journée, semaine, rencontre, local, report | P0 |
| Feuille de match | Encodage du fait sportif | Alignement, partie, set, score, forfait, abandon | P0 |
| Validation et contrôle | Officialisation du résultat | Confirmation, anomalie, correction, litige | P0 |
| Classements | Calculs dérivés | Classement d'équipe, individuel, points, historique | P0/P1 |
| Sanctions et amendes | Conséquences administratives | Infraction, contrôle, sanction, amende, recours | P1 |
| Tournois | Compétitions individuelles | Tournoi, série, inscription, tableau, résultat | Hors pilote |
| Publication | Diffusion maîtrisée | Résultat public, API, export, notification | P0 |
| Accès et audit | Responsabilité des actions | Compte, rôle, délégation, journal, justification | P0 |
| Facturation et paiements | Transactions éventuelles | Droit d'inscription, facture, remboursement | Hors pilote |

## Vocabulaire canonique

### Organisation

- **Fédération** : autorité qui possède les données et définit les règles communes.
- **Entité organisatrice** : fédération, aile, province ou autre organe responsable d'une compétition.
- **Club** : organisation affiliée possédant un indice officiel et un historique de statut.
- **Local** : lieu de compétition avec adresse, tables, disponibilités et contraintes d'accès.
- **Responsable** : personne disposant d'une délégation limitée dans le temps et dans le périmètre.

### Identité

- **Personne** : identité humaine, distincte de ses licences et affiliations.
- **Licence** : identifiant sportif délivré par une fédération.
- **Affiliation** : relation temporelle entre une personne, un club et une saison.
- **Catégorie de joueur** : catégorie d'âge, de genre ou de compétition applicable pendant une période.
- **Classement sportif** : valeur officielle versionnée, distincte des points numériques calculés.

### Compétition

- **Compétition** : ensemble de règles et d'épreuves administré par une entité organisatrice.
- **Phase** : portion de compétition pouvant posséder son propre calendrier et ses propres règles.
- **Division** : groupe d'équipes partageant un classement.
- **Journée** : unité réglementaire ; elle n'est pas nécessairement égale à une date civile.
- **Rencontre** : opposition officielle entre deux équipes.
- **Partie** : opposition individuelle ou double à l'intérieur d'une rencontre.
- **Système de rencontre** : ordre et règles des parties nécessaires pour déterminer le score final.

### Résultat et décision

- **Feuille de match** : document métier versionné contenant les participants et résultats déclarés.
- **Soumission** : déclaration d'un club ; elle ne rend pas encore le résultat officiel.
- **Confirmation** : accord de l'adversaire sur le contenu déclaré.
- **Validation** : décision de l'autorité organisatrice qui officialise le résultat.
- **Correction** : nouvelle version motivée d'une donnée, jamais un écrasement silencieux.
- **Anomalie** : violation potentielle d'une règle nécessitant blocage, avertissement ou contrôle humain.
- **Décision** : acte humain ou automatique justifié qui résout une anomalie ou un litige.

## Cycle de vie principal d'une rencontre

1. La compétition et son système de rencontre sont publiés.
2. Les équipes et leurs joueurs éligibles sont enregistrés.
3. La rencontre est planifiée pour une journée et un local.
4. Un report ou changement éventuel est demandé, accepté et historisé.
5. Les capitaines déclarent leurs disponibilités et compositions.
6. La feuille est ouverte, éventuellement sans connexion.
7. Les joueurs, doubles, responsables et heures sont encodés.
8. Les parties et sets sont saisis ou déclarés comme forfait/abandon.
9. Le système calcule le score, vérifie les contraintes et produit les anomalies.
10. Le club responsable soumet la feuille.
11. L'adversaire confirme ou conteste.
12. L'organisateur traite les anomalies et valide.
13. Le résultat officiel est publié.
14. Les projections de classement, statistiques et notifications sont recalculées.
15. Une correction ultérieure crée une nouvelle version, déclenche un recalcul et conserve l'historique.

## États proposés pour une feuille de match

| État | Signification | Écriture autorisée |
| --- | --- | --- |
| `scheduled` | Rencontre publiée, feuille non ouverte | Organisateur uniquement |
| `draft` | Encodage en cours | Capitaines autorisés |
| `submitted` | Déclaration terminée par le club responsable | Correction par retour motivé |
| `confirmed` | Accord de l'adversaire | Organisateur uniquement |
| `contested` | Désaccord explicite | Organisateur et parties au litige |
| `under_review` | Contrôle administratif en cours | Organisateur |
| `validated` | Résultat officiellement décidé | Nouvelle révision uniquement |
| `published` | Projections publiques mises à jour | Nouvelle révision uniquement |
| `cancelled` | Rencontre annulée avec motif | Organisateur |

Le passage `validated → published` doit être idempotent. Une publication partiellement échouée doit pouvoir être rejouée sans dupliquer les effets.

## Catalogue initial des règles

### Référentiels et temporalité

| ID | Question métier à formaliser | Exemple attendu |
| --- | --- | --- |
| REF-001 | Comment déterminer la saison applicable à une date ? | Rencontre reportée après la date théorique |
| REF-002 | Quelles valeurs de classement sont valides par catégorie et saison ? | Apparition ou suppression d'un échelon |
| REF-003 | Quand une affiliation ou un transfert prend-il effet ? | Joueur changeant de club en cours de saison |
| REF-004 | Quels identifiants sont uniques, et dans quel périmètre ? | Même numéro dans deux fédérations |
| REF-005 | Quelle langue utiliser pour une décision ou notification ? | Club bilingue, joueur francophone |

### Compétitions et calendrier

| ID | Question métier à formaliser | Exemple attendu |
| --- | --- | --- |
| CMP-001 | Qui peut créer ou modifier une division ? | Province organisatrice vs niveau national |
| CMP-002 | Comment inscrire, refuser ou retirer une équipe ? | Retrait après publication du calendrier |
| CMP-003 | Comment sont déterminées montées, descentes et tours finaux ? | Ex aequo ou division incomplète |
| CAL-001 | Comment générer les rencontres depuis une grille ? | Aller-retour avec nombre impair d'équipes |
| CAL-002 | Qui peut demander, accepter et imposer un report ? | Accord des deux clubs après échéance |
| CAL-003 | Quelle date compte pour les règles et classements ? | Date initiale, journée ou date réellement jouée |
| CAL-004 | Comment gérer bye, forfait général et compétition interrompue ? | Retrait d'équipe à mi-saison |

### Éligibilité et composition

| ID | Question métier à formaliser | Exemple attendu |
| --- | --- | --- |
| ELG-001 | Un joueur est-il affilié et actif à la date de la rencontre ? | Affiliation activée le lendemain |
| ELG-002 | La catégorie du joueur lui permet-elle de participer ? | Jeune, vétéran, genre ou compétition mixte |
| ELG-003 | Le joueur a-t-il dépassé une limite de participations ? | Brûlage ou restriction d'équipe |
| ELG-004 | L'ordre des joueurs respecte-t-il la liste de force ? | Remplaçant mieux classé qu'un titulaire |
| ELG-005 | Les doubles respectent-ils les contraintes de composition ? | Paire réutilisée ou joueur absent des simples |
| ELG-006 | Un joueur peut-il participer à plusieurs rencontres proches ? | Même journée ou catégories distinctes |

### Encodage des résultats

| ID | Question métier à formaliser | Exemple attendu |
| --- | --- | --- |
| MAT-001 | Combien de joueurs, doubles et parties exige le système ? | Rencontre à 3, 4 ou 6 joueurs |
| MAT-002 | Dans quel ordre les parties doivent-elles être disputées ? | Interruption après score acquis |
| MAT-003 | Combien de sets et points déterminent une victoire ? | Meilleur des 5 ou meilleur des 7 |
| MAT-004 | Comment encoder un forfait individuel ou collectif ? | Un joueur absent dès le début |
| MAT-005 | Comment encoder un abandon après le début d'une partie ? | Sets joués avant blessure |
| MAT-006 | Comment traiter une partie non jouée ? | Score acquis, incident ou décision administrative |
| MAT-007 | Quelles métadonnées sont obligatoires ? | Capitaines, juge-arbitre, heures, commentaires |
| MAT-008 | Quelles incohérences bloquent ou avertissent ? | Score global différent du détail |

### Validation, contrôle et sanctions

| ID | Question métier à formaliser | Exemple attendu |
| --- | --- | --- |
| VAL-001 | Quel club est responsable de la soumission et sous quel délai ? | Club visité n'encode pas dans les 24 h |
| VAL-002 | Quel délai et quel mécanisme de confirmation s'appliquent ? | Adversaire silencieux |
| VAL-003 | Quelles anomalies peuvent être validées avec justification ? | Joueur non classé mais autorisé exceptionnellement |
| VAL-004 | Qui peut corriger un résultat officiel ? | Province, fédération ou commission |
| VAL-005 | Quels recalculs déclencher après correction ? | Classement, points, notifications, amendes |
| SAN-001 | Quelle anomalie produit quelle amende ? | Retard, joueur non éligible, feuille incomplète |
| SAN-002 | Comment contester et annuler une sanction ? | Recours accepté après publication |

### Classements

| ID | Question métier à formaliser | Exemple attendu |
| --- | --- | --- |
| RNK-001 | Comment attribuer les points de rencontre aux équipes ? | Victoire, nul, forfait ou bonus |
| RNK-002 | Quels critères départagent les équipes ? | Confrontation directe, parties, sets, points |
| RNK-003 | Comment traiter les résultats d'une équipe retirée ? | Conservation ou annulation des rencontres |
| RNK-004 | Quelles parties comptent pour le classement individuel ? | Forfait, abandon, tournoi ou amical |
| RNK-005 | Quel barème numérique s'applique ? | Résultat attendu ou inattendu |
| RNK-006 | Comment arrondir et présenter les points ? | Décimales internes et affichage entier |
| RNK-007 | À partir de quand une correction recalcule-t-elle l'historique ? | Correction d'une journée ancienne |
| RNK-008 | Comment versionner une réforme du classement ? | Nouveau barème en début de saison |

### Publication et confidentialité

| ID | Question métier à formaliser | Exemple attendu |
| --- | --- | --- |
| PUB-001 | Quelles données d'un joueur sont publiques ? | Nom, licence, club, résultats, photo |
| PUB-002 | Quelles données exigent un rôle ou un consentement spécifique ? | Adresse, e-mail, téléphone, date de naissance |
| PUB-003 | Quand notifier un changement ? | Première publication ou correction matérielle |
| PUB-004 | Comment signaler l'ancienneté d'une projection ? | Synchronisation fédérale retardée |
| PUB-005 | Quels exports officiels doivent rester disponibles ? | PDF, CSV, API, archivage de saison |

## Sources à confronter

| Source | Valeur | Limite |
| --- | --- | --- |
| Règlements fédéraux versionnés | Intention officielle | Exceptions opérationnelles parfois absentes |
| Documentation TabT | Concepts et parcours | Partiellement ancienne ou incomplète |
| Code et schéma publics TabT | Comportement implémenté | Production potentiellement différente |
| WSDL et réponses SOAP | Contrat observable | Expose surtout la lecture publique |
| Base de données exportée | Historique réel | N'explique pas la raison d'une décision |
| `tabt-rest` et importateurs | Connaissance d'intégration BePing | N'est pas la source métier officielle |
| Responsables fédéraux/provinciaux | Exceptions et processus réels | Connaissance parfois orale ou divergente |
| Jeux de données historiques | Vérification de parité | Ne couvre pas nécessairement tous les cas futurs |

## Périmètre du pilote

### Inclus

- une fédération ou aile ;
- une province ou entité organisatrice ;
- une saison ;
- une catégorie interclubs ;
- un ou deux systèmes de rencontre ;
- clubs, joueurs et équipes nécessaires au pilote ;
- calendrier, report, composition et feuille de match ;
- validation, publication et classement d'équipe ;
- audit et export vers TabT.

### Exclus par défaut

- gestion complète des affiliations et transferts ;
- facturation ;
- tournois individuels ;
- calcul définitif des nouveaux classements annuels ;
- toutes les provinces et catégories ;
- suppression de TabT ;
- migration des comptes et mots de passe historiques.

## Critère de sortie de la découverte métier

La découverte est terminée lorsque chaque règle P0 possède :

- un propriétaire métier ;
- une référence réglementaire ou une décision signée ;
- au moins un exemple nominal ;
- au moins un cas limite lorsque pertinent ;
- un effet attendu sur les données ;
- une politique de correction ;
- un niveau de visibilité publique ;
- un test automatisable ou une justification expliquant pourquoi il doit rester manuel.

