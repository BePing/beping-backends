# Configuration Guide

## Environment Variables

Create a `.env` file in your project root with the following variables:

```bash
# Firebase Configuration (choose one method)

# Method 1: Path to service account key file (recommended for local development)
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=/path/to/firebase-service-account-key.json

# Method 2: Service account key as JSON string (recommended for containerized deployments)
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id","private_key_id":"key-id","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-...@your-project.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-...%40your-project.iam.gserviceaccount.com"}'

# Optional: Firebase App ID for App Check verification (get from Firebase Console)
FIREBASE_APP_ID=1:123456789:android:abcdef123456

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/database_name"
DIRECT_URL="postgresql://username:password@localhost:5432/database_name"

# Redis Configuration (for microservice communication)
REDIS_HOST=localhost
REDIS_PORT=6379

# Server Configuration
PORT=3002

# Optional: Logging
LOG_LEVEL=debug
```

## Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing project
3. Add your mobile apps (Android/iOS) to the project

### 2. Enable App Check
1. In Firebase Console, go to **Project Settings** → **App Check**
2. Click **Get started**
3. For each app platform, configure attestation:

#### Android App Check
1. Select your Android app
2. Choose **Play Integrity API** as the attestation provider
3. Register your app in Google Play Console (required for Play Integrity)
4. Configure your Android app to use App Check (see README.md for code examples)

#### iOS App Check
1. Select your iOS app
2. Choose **DeviceCheck** or **App Attest** as the attestation provider
3. Configure your iOS app to use App Check (see README.md for code examples)

#### Web App Check (if applicable)
1. Select your Web app
2. Choose **reCAPTCHA v3** as the attestation provider
3. Configure reCAPTCHA site key and secret

### 3. Generate Service Account Key
1. In Firebase Console, go to **Project Settings** → **Service accounts**
2. Click **Generate new private key**
3. Download the JSON file
4. Either:
   - Place the file in your project and set `FIREBASE_SERVICE_ACCOUNT_KEY_PATH`
   - Or copy the JSON content to `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable

### 4. Get Firebase App ID (Optional)
1. In Firebase Console, go to **Project Settings** → **General**
2. In the **Your apps** section, find your app
3. Copy the **App ID** (format: `1:123456789:android:abcdef123456`)
4. Set this as `FIREBASE_APP_ID` for additional App Check validation

## Database Setup

### 1. Apply Database Migrations
```bash
# Generate Prisma client
npm run prisma:generate

# Apply pending migrations
npm run prisma:deploy
```

### 2. Create API Consumer for Basic Auth
Insert a record in the `APIConsumer` table for backend services:

```sql
INSERT INTO "APIConsumer" (app, password) 
VALUES ('backend-service', 'your-secure-password');
```

## Basic Auth Configuration

For backend services that send notifications, they need to authenticate using Basic Auth:

- **Username**: The `app` value from `APIConsumer` table
- **Password**: The `password` value from `APIConsumer` table

Example authorization header:
```
Authorization: Basic YmFja2VuZC1zZXJ2aWNlOnlvdXItc2VjdXJlLXBhc3N3b3Jk
```

Where the base64 string is: `base64('backend-service:your-secure-password')`

## Testing Configuration

### Development Mode
For development/testing without proper Firebase setup:
- Don't set Firebase environment variables
- The App Check guard will log warnings but allow requests through
- You can test mobile endpoints without App Check tokens

### Production Mode
For production:
- Set all Firebase environment variables
- Enable App Check in Firebase Console
- Configure proper attestation providers
- Use HTTPS for all communications
- Secure your environment variables

## Troubleshooting

### App Check Issues
- **401 Unauthorized on mobile endpoints**: Check App Check token is included in `X-Firebase-AppCheck` header
- **App Check token invalid**: Verify App Check is properly configured in Firebase Console and mobile app
- **App ID mismatch**: Ensure `FIREBASE_APP_ID` matches your Firebase app configuration

### Firebase Admin SDK Issues
- **Firebase not initialized**: Check service account key path/content is correct
- **Permission denied**: Ensure service account has proper Firebase Admin permissions
- **Invalid credentials**: Verify service account key is valid and not expired

### Database Issues
- **Prisma client errors**: Run `npm run prisma:generate` after schema changes
- **Migration issues**: Check database connection and run migrations with `npm run prisma:deploy`

### Authentication Issues
- **Basic auth fails**: Verify `APIConsumer` table has correct credentials
- **Unauthorized on send endpoints**: Check Basic Auth header format and credentials 