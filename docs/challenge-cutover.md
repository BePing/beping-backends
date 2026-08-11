# Bascule des challenges communautaires

Cette procédure ne doit être exécutée qu'après revue du SHA, avec PostgreSQL et
Firestore sauvegardés. Aucun classement historique Firestore n'est importé.

## 1. Sauvegardes et restauration

1. Déclencher un backup PostgreSQL Coolify et vérifier son objet hors site.
2. Restaurer ce dump dans une base PostgreSQL isolée.
3. Exporter Firestore intégralement vers un bucket d'archive dédié :

   ```bash
   gcloud firestore export "gs://BUCKET_ARCHIVE/firestore-before-challenges-$(date +%Y%m%d)" \
     --project=PROJECT_ID --async
   ```

4. Attendre l'état `SUCCESSFUL` et appliquer une règle de rétention au bucket.
   Ne pas désactiver Firestore à ce stade.
5. Révoquer les anciennes clés Mailjet exposées pendant l'audit et placer
   uniquement les nouvelles valeurs dans Coolify.

## 2. Migration de configuration

1. Copier `apps/challenge-worker/config/season-27.challenge.example.json` dans
   un fichier local ignoré par Git.
2. Reporter les destinataires Firestore dans `pressRecipients`.
3. Interroger `/v1/divisions` avec `X-Tabt-Season: 27` et le compte provincial,
   puis remplir chaque niveau. Chaque niveau doit contenir au moins une
   division; l'activation échoue sinon.
4. Exécuter la migration Prisma dans la base isolée.
5. Lancer `import-config`, puis `activate challenge-provincial 27`. Contrôler
   qu'aucune valeur de secret ne figure dans les tables ou les logs.

## 3. Répétition du cycle

Dans la base isolée, choisir une entrée calendrier et exécuter les commandes
avec `CHALLENGE_JOB_DATE` : dimanche, lundi, puis jeudi. Vérifier :

- tous les participants, y compris zéro point et au-delà de la limite presse;
- absence de publication après dimanche et lundi;
- livraison presse provisoire puis finale vers une boîte de test;
- publication jeudi du même `runId` et du même checksum que le lundi;
- conservation de la publication précédente si le lundi ou la livraison
  échoue;
- insertion unique de `CHALLENGE_PUBLISHED` dans l'outbox.

## 4. Production

Publier et déployer les images au tag SHA complet. Le worker démarre à 0,5 CPU,
768 Mo et `DB_POOL_MAX=1`, sans domaine, port public ni port PostgreSQL exposé.
Le web utilise `escape-key/beping-challenge-web:<sha>` sur
`challenges.beping.be` et reçoit `NUXT_PUBLIC_BEPING_API_BASE_URL` au build.

Activer les trois tâches Coolify seulement après la répétition complète. Après
la première publication du jeudi, vérifier l'API, le site et une fiche joueur
Flutter avant de supprimer les droits Firestore de l'ancien calculateur. Garder
l'export d'archive; ne supprimer aucun historique dans cette bascule.
