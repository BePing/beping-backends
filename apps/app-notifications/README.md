# App Notifications Service

A NestJS microservice that handles Firebase Cloud Messaging (FCM) notifications with subscription management. This service accepts calls from other applications and sends notifications only to subscribed devices.

## Features

- ✅ FCM integration with Firebase Admin SDK
- ✅ Device subscription management with **Firebase App Check** verification
- ✅ Notification type filtering
- ✅ Batch notification sending
- ✅ Comprehensive logging and error handling
- ✅ **Dual authentication**: App Check for mobile apps, Basic Auth for backend services
- ✅ Support for Android, iOS, and Web platforms
- ✅ Automatic invalid token cleanup

## Security Architecture

This service uses a dual authentication approach:

- **Mobile App Endpoints** (device registration, unregistration, notification preferences): Protected by **Firebase App Check** to ensure requests come from your authentic mobile applications
- **Backend Service Endpoints** (sending notifications, monitoring): Protected by **Basic Authentication** for other backend services
- **Public Endpoints** (health check): No authentication required

## Environment Variables

```bash
# Firebase Configuration (choose one)
FIREBASE_SERVICE_ACCOUNT_KEY_PATH=/path/to/service-account-key.json
# OR
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'

# Optional: Firebase App ID for App Check verification
FIREBASE_APP_ID=1:123456789:android:abcdef123456

# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Redis (for microservice communication)
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3002
```

## Firebase App Check Setup

### 1. Enable App Check in Firebase Console
1. Go to Firebase Console → Project Settings → App Check
2. Enable App Check for your iOS/Android/Web apps
3. Configure attestation providers:
   - **Android**: Play Integrity API
   - **iOS**: DeviceCheck or App Attest
   - **Web**: reCAPTCHA v3

### 2. Mobile App Integration

#### Android
```kotlin
// Initialize App Check in your Application class
FirebaseApp.initializeApp(this)
Firebase.appCheck.installAppCheckProviderFactory(
    PlayIntegrityAppCheckProviderFactory.getInstance()
)

// When making API calls, include App Check token
Firebase.appCheck.getAppCheckToken(false).addOnCompleteListener { task ->
    if (task.isSuccessful) {
        val token = task.result.token
        // Include token in X-Firebase-AppCheck header
        val headers = mapOf("X-Firebase-AppCheck" to token)
        apiService.registerDevice(request, headers)
    }
}
```

#### iOS
```swift
// Initialize App Check in AppDelegate
AppCheck.setAppCheckProviderFactory(DeviceCheckProviderFactory())

// When making API calls, include App Check token
AppCheck.appCheck().token(forcingRefresh: false) { (token, error) in
    if let token = token {
        // Include token in X-Firebase-AppCheck header
        let headers = ["X-Firebase-AppCheck": token.token]
        apiService.registerDevice(request: request, headers: headers)
    }
}
```

## API Endpoints

### Mobile App Endpoints (App Check Protected)

These endpoints require the `X-Firebase-AppCheck` header with a valid App Check token.

#### Register Device
```http
POST /notifications/devices/register
Content-Type: application/json
X-Firebase-AppCheck: <app-check-token>

{
  "deviceToken": "fcm_device_token_here",
  "platform": "ANDROID",
  "notificationTypes": ["MATCH", "RANKING"],
  "userId": "user123",
  "appVersion": "1.0.0",
  "metadata": {
    "deviceModel": "Samsung Galaxy S21",
    "osVersion": "Android 12"
  }
}
```

#### Unregister Device
```http
DELETE /notifications/devices/{deviceToken}
X-Firebase-AppCheck: <app-check-token>
```

#### Update Notification Types
```http
PUT /notifications/devices/{deviceToken}/notification-types
Content-Type: application/json
X-Firebase-AppCheck: <app-check-token>

{
  "notificationTypes": ["MATCH", "CUSTOM"]
}
```

### Backend Service Endpoints (Basic Auth Protected)

These endpoints require Basic Authentication credentials configured in the database.

#### Send to Subscribed Devices
```http
POST /notifications/send
Content-Type: application/json
Authorization: Basic <credentials>

{
  "title": "Match Result",
  "body": "Your match result is available!",
  "notificationType": "MATCH",
  "data": {
    "matchId": "123",
    "action": "view_result"
  }
}
```

#### Send to Specific User
```http
POST /notifications/send
Content-Type: application/json
Authorization: Basic <credentials>

{
  "title": "Personal Notification",
  "body": "Your ranking has been updated!",
  "notificationType": "RANKING",
  "targetUserId": "user123",
  "data": {
    "newRanking": "15",
    "previousRanking": "18"
  }
}
```

#### Send to Specific Devices
```http
POST /notifications/send
Content-Type: application/json
Authorization: Basic <credentials>

{
  "title": "Direct Notification",
  "body": "Important update!",
  "notificationType": "CUSTOM",
  "targetDeviceTokens": ["token1", "token2"],
  "data": {
    "urgency": "high"
  }
}
```

### Monitoring Endpoints (Basic Auth Protected)

#### Get Active Subscriptions
```http
GET /notifications/subscriptions
Authorization: Basic <credentials>

# Filter by notification type
GET /notifications/subscriptions?notificationType=MATCH
```

#### Get Notification Statistics
```http
GET /notifications/stats
Authorization: Basic <credentials>

# Filter by device token
GET /notifications/stats?deviceToken={token}
```

### Public Endpoints

#### Health Check
```http
GET /notifications/health
```

## Notification Types

- `MATCH`: Match-related notifications
- `RANKING`: Ranking update notifications  
- `CUSTOM`: Custom notifications from other applications

## Device Platforms

- `ANDROID`: Android devices
- `IOS`: iOS devices
- `WEB`: Web applications

## Database Schema

The service uses the following main models:

### DeviceSubscription
```prisma
model DeviceSubscription {
  id                String           @id @default(cuid())
  userId            String?          // Optional user ID
  deviceToken       String           @unique
  platform          DevicePlatform
  appVersion        String?
  active            Boolean          @default(true)
  notificationTypes NotificationType[]
  metadata          Json?
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  lastUsed          DateTime         @default(now())
}
```

### NotificationLog
```prisma
model NotificationLog {
  id                    String               @id @default(cuid())
  deviceSubscriptionId  String?
  notificationType      NotificationType
  title                 String
  body                  String
  data                  Json?
  fcmMessageId          String?
  status                NotificationStatus
  errorMessage          String?
  sentAt                DateTime             @default(now())
}
```

## Usage Examples

### From Another NestJS Application
```typescript
import { HttpService } from '@nestjs/axios';

@Injectable()
export class MyService {
  constructor(private readonly httpService: HttpService) {}

  async sendMatchNotification(matchId: string) {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    
    await this.httpService.post(
      'http://app-notifications:3002/notifications/send',
      {
        title: 'Match Update',
        body: `Match ${matchId} has been updated`,
        notificationType: 'MATCH',
        data: { matchId }
      },
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      }
    ).toPromise();
  }
}
```

### Mobile App Integration

#### Android (Kotlin)
```kotlin
// Register device with App Check token
private suspend fun registerDevice(token: String) {
    val appCheckToken = Firebase.appCheck.getAppCheckToken(false).await()
    
    val request = RegisterDeviceRequest(
        deviceToken = token,
        platform = "ANDROID",
        notificationTypes = listOf("MATCH", "RANKING"),
        userId = getCurrentUserId(),
        appVersion = BuildConfig.VERSION_NAME
    )
    
    val headers = mapOf("X-Firebase-AppCheck" to appCheckToken.token)
    apiService.registerDevice(request, headers)
}
```

#### iOS (Swift)
```swift
// Register device with App Check token
func registerDevice(token: String) async {
    do {
        let appCheckToken = try await AppCheck.appCheck().token(forcingRefresh: false)
        
        let request = RegisterDeviceRequest(
            deviceToken: token,
            platform: "IOS",
            notificationTypes: ["MATCH", "RANKING"],
            userId: getCurrentUserId(),
            appVersion: Bundle.main.appVersion
        )
        
        let headers = ["X-Firebase-AppCheck": appCheckToken.token]
        try await apiService.registerDevice(request: request, headers: headers)
    } catch {
        print("Failed to register device: \(error)")
    }
}
```

## Error Handling

The service automatically handles:
- Invalid FCM tokens (removes from database)
- Unregistered tokens (removes from database)
- Failed deliveries (logs with error details)
- Batch sending failures (partial success handling)
- Invalid App Check tokens (returns 401 Unauthorized)
- Missing authentication (returns 401 Unauthorized)

## Development & Testing

For development/testing without proper Firebase App Check setup:
- The App Check guard will log a warning and allow requests through if Firebase is not initialized
- You can disable App Check verification temporarily by not setting the Firebase environment variables

## Deployment

1. Set up Firebase project and enable App Check
2. Download service account key and configure environment variables
3. Configure attestation providers for your mobile apps
4. Run database migrations: `npm run prisma:deploy`
5. Build and start the service: `npm run build:app-notifications && npm run start:prod:app-notifications`

## Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Start in development mode
npm run start:dev:app-notifications
```

## Security Benefits

- **App Check**: Ensures device registration requests come from your authentic mobile apps, preventing abuse from modified or fake apps
- **Basic Auth**: Secures backend-to-backend communication for sending notifications
- **Token Validation**: Automatically removes invalid/expired FCM tokens
- **Request Logging**: Comprehensive audit trail of all notification activities
- **Firebase Security**: Leverages Google's robust authentication and security infrastructure 