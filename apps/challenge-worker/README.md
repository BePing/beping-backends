# Challenge worker

Worker PostgreSQL des classements communautaires et non officiels. Il n'expose
aucun port et ne lit ni n'écrit Firestore.

Sans commande explicite, l'image démarre en mode `idle` afin que Coolify garde
le conteneur disponible entre les exécutions de tâches. Ce mode ne calcule et
n'envoie rien.

## Commandes

Après `pnpm build:challenge-worker` :

```bash
node dist/apps/challenge-worker/main.js import-config /run/config/challenge.json
node dist/apps/challenge-worker/main.js validate-config
node dist/apps/challenge-worker/main.js activate challenge-provincial 27
node dist/apps/challenge-worker/main.js sunday
node dist/apps/challenge-worker/main.js monday
node dist/apps/challenge-worker/main.js thursday
```

`CHALLENGE_JOB_DATE=YYYY-MM-DD` permet de répéter un cycle dans une base isolée.
Sans entrée `ChallengeChampionshipWeek` pour cette date bruxelloise, une commande
planifiée retourne `SKIPPED_NO_CHAMPIONSHIP_WEEK`.

L'import laisse toujours le challenge et la saison inactifs. `activate` vérifie
avant écriture le slug, les clubs/régions, toutes les divisions/niveaux, le
calendrier, les règles, les destinataires et la présence des variables Coolify.

## Variables

- `DATABASE_URL`, avec PostgreSQL uniquement sur le réseau privé Coolify;
- `DB_POOL_MAX=1`;
- `BEPING_API_BASE_URL=https://api-v2.beping.be`;
- `CHALLENGE_WORKER_IMAGE_SHA`, égal au tag immuable déployé;
- les variables référencées par `ChallengeSecretReference`, notamment les
  nouvelles clés Mailjet, `PRESS_SENDER_EMAIL`, `TABT_ACCOUNT` et
  `TABT_PASSWORD`.

Les valeurs ne sont jamais persistées. Les erreurs de livraison ne contiennent
ni destinataire ni secret. Une livraison `UNKNOWN` bloque toute nouvelle
tentative automatique et la publication du jeudi.

## Planification Coolify

Configurer le fuseau `Europe/Brussels` et trois tâches :

| Commande   | Cron         | Rôle                                       |
| ---------- | ------------ | ------------------------------------------ |
| `sunday`   | `0 18 * * 0` | calcul complet et presse provisoire privée |
| `monday`   | `0 20 * * 1` | nouveau calcul et presse finale privée     |
| `thursday` | `0 8 * * 4`  | publication atomique du run final du lundi |

Une sortie non nulle est une alerte de tâche. Les événements structurés
`CHALLENGE_JOB_METRIC` et `CHALLENGE_JOB_ALERT` contiennent le challenge, la
durée, le nombre de joueurs, le checksum, l'état presse et l'état publié.

## Première configuration saison 27

Copier `config/season-27.challenge.example.json` hors du dépôt, compléter les
destinataires et les identifiants de divisions AFTT saison 27, puis importer la
copie. L'exemple conserve le mapping de la saison 26 uniquement comme trace de
migration; ces identifiants ne sont jamais activés pour la saison 27.
