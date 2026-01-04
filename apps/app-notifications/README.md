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
- ✅ **AI-powered notification text generation** using OpenAI
- ✅ **Federation backend integration** for match result notifications
- ✅ **Automatic ranking estimation change notifications** from data imports
- ✅ **Bulk topic subscription** management for mobile apps

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

# OpenAI (for AI-powered notification text generation)
OPENAI_API_KEY=sk-...

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

#### Subscribe to Topic
```http
POST /notifications/devices/{deviceToken}/topics
Content-Type: application/json
X-Firebase-AppCheck: <app-check-token>

{
  "topic": "match:12345"
}
```

#### Unsubscribe from Topic
```http
DELETE /notifications/devices/{deviceToken}/topics/{topic}
X-Firebase-AppCheck: <app-check-token>
```

#### Get Subscribed Topics
```http
GET /notifications/devices/{deviceToken}/topics
X-Firebase-AppCheck: <app-check-token>
```

#### Bulk Subscribe to Topics
```http
POST /notifications/devices/{deviceToken}/topics/bulk
Content-Type: application/json
X-Firebase-AppCheck: <app-check-token>

{
  "topics": ["match:12345", "player:67890", "club:11111"]
}
```

#### Bulk Unsubscribe from Topics
```http
DELETE /notifications/devices/{deviceToken}/topics/bulk
Content-Type: application/json
X-Firebase-AppCheck: <app-check-token>

{
  "topics": ["match:12345", "player:67890"]
}
```

### Backend Service Endpoints (Basic Auth Protected)

These endpoints require Basic Authentication credentials configured in the database.

#### Match Result Event (Federation Backend)
```http
POST /events/match-result
Content-Type: application/json
Authorization: Basic <credentials>

{
  "matchId": "12345"
}
```

This endpoint is called by the federation backend when a match result is available. It automatically sends notifications to all devices subscribed to the `match:{matchId}` topic with AI-generated, localized content.

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

## Topic Subscription System

The service supports topic-based subscriptions, allowing mobile apps to subscribe to specific entities and receive notifications when those entities are updated.

### Supported Topic Patterns

- `match:{matchId}` - Subscribe to specific match updates
- `player:{uniqueIndex}` - Subscribe to specific player updates (rankings, results, etc.)
- `club:{clubId}` - Subscribe to club-related updates
- `division:{divisionId}` - Subscribe to division updates
- `tournament:{tournamentId}` - Subscribe to tournament updates
- `ranking:monthly` - Subscribe to monthly ranking updates (future use)
- `ranking:weekly` - Subscribe to weekly ranking updates (future use)

### How Topics Work

1. **Mobile apps subscribe** to topics they're interested in using the topic subscription endpoints
2. **Backend services send events** to the notification service (e.g., match result available, ranking changed)
3. **Notification service** finds all devices subscribed to the relevant topic
4. **Notifications are sent** with AI-generated, localized content based on device locale

## AI-Powered Notifications

All notifications use OpenAI to generate engaging, localized notification text. The service:

- Automatically generates title and body text based on event context
- Localizes content based on device locale (language)
- Falls back to default text if AI generation fails
- Uses GPT-4o-mini for cost-effective, fast text generation

### Supported Locales

The service supports any locale code (e.g., `en`, `fr`, `nl`, `de`). Content is generated in the device's configured locale.

## Notification Types

- `MATCH`: Match-related notifications (match results, match updates)
- `RANKING`: Ranking update notifications (ranking changes, ranking estimation changes)
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

## Automatic Notifications

The service automatically sends notifications in the following scenarios:

### Ranking Estimation Changes

When the data importer detects that a player's ranking estimation (`rankingLetterEstimation`) has changed:

1. The data importer sends a `RANKING_ESTIMATION_CHANGE` event via Redis microservice
2. The notification service receives the event
3. Notifications are sent to all devices subscribed to the `player:{uniqueIndex}` topic
4. AI-generated, localized notification text is created for each device's locale

This happens automatically during the members list import process.

## Usage Examples

### From Another NestJS Application

#### Sending Match Result Notification (Federation Backend)
```typescript
import { HttpService } from '@nestjs/axios';

@Injectable()
export class FederationService {
  constructor(private readonly httpService: HttpService) {}

  async notifyMatchResult(matchId: string) {
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    
    await this.httpService.post(
      'http://app-notifications:3002/events/match-result',
      { matchId },
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

#### Sending Custom Notification
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

##### Register Device
```kotlin
// Register device with App Check token
private suspend fun registerDevice(token: String) {
    val appCheckToken = Firebase.appCheck.getAppCheckToken(false).await()
    
    val request = RegisterDeviceRequest(
        deviceToken = token,
        platform = "ANDROID",
        notificationTypes = listOf("MATCH", "RANKING"),
        userId = getCurrentUserId(),
        appVersion = BuildConfig.VERSION_NAME,
        locale = Locale.getDefault().language
    )
    
    val headers = mapOf("X-Firebase-AppCheck" to appCheckToken.token)
    apiService.registerDevice(request, headers)
}
```

##### Subscribe to Topics
```kotlin
// Subscribe to a specific match
private suspend fun subscribeToMatch(matchId: String) {
    val appCheckToken = Firebase.appCheck.getAppCheckToken(false).await()
    val headers = mapOf("X-Firebase-AppCheck" to appCheckToken.token)
    
    apiService.subscribeToTopic(
        deviceToken = getDeviceToken(),
        topic = "match:$matchId",
        headers = headers
    )
}

// Subscribe to a player's updates
private suspend fun subscribeToPlayer(playerId: Int) {
    val appCheckToken = Firebase.appCheck.getAppCheckToken(false).await()
    val headers = mapOf("X-Firebase-AppCheck" to appCheckToken.token)
    
    apiService.subscribeToTopic(
        deviceToken = getDeviceToken(),
        topic = "player:$playerId",
        headers = headers
    )
}

// Bulk subscribe to multiple topics
private suspend fun subscribeToMultipleTopics(topics: List<String>) {
    val appCheckToken = Firebase.appCheck.getAppCheckToken(false).await()
    val headers = mapOf("X-Firebase-AppCheck" to appCheckToken.token)
    
    apiService.bulkSubscribeToTopics(
        deviceToken = getDeviceToken(),
        topics = topics,
        headers = headers
    )
}
```

#### iOS (Swift)

##### Register Device
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
            appVersion: Bundle.main.appVersion,
            locale: Locale.current.languageCode ?? "en"
        )
        
        let headers = ["X-Firebase-AppCheck": appCheckToken.token]
        try await apiService.registerDevice(request: request, headers: headers)
    } catch {
        print("Failed to register device: \(error)")
    }
}
```

##### Subscribe to Topics
```swift
// Subscribe to a specific match
func subscribeToMatch(matchId: String) async {
    do {
        let appCheckToken = try await AppCheck.appCheck().token(forcingRefresh: false)
        let headers = ["X-Firebase-AppCheck": appCheckToken.token]
        
        try await apiService.subscribeToTopic(
            deviceToken: getDeviceToken(),
            topic: "match:\(matchId)",
            headers: headers
        )
    } catch {
        print("Failed to subscribe to match: \(error)")
    }
}

// Subscribe to a player's updates
func subscribeToPlayer(playerId: Int) async {
    do {
        let appCheckToken = try await AppCheck.appCheck().token(forcingRefresh: false)
        let headers = ["X-Firebase-AppCheck": appCheckToken.token]
        
        try await apiService.subscribeToTopic(
            deviceToken: getDeviceToken(),
            topic: "player:\(playerId)",
            headers: headers
        )
    } catch {
        print("Failed to subscribe to player: \(error)")
    }
}

// Bulk subscribe to multiple topics
func subscribeToMultipleTopics(topics: [String]) async {
    do {
        let appCheckToken = try await AppCheck.appCheck().token(forcingRefresh: false)
        let headers = ["X-Firebase-AppCheck": appCheckToken.token]
        
        try await apiService.bulkSubscribeToTopics(
            deviceToken: getDeviceToken(),
            topics: topics,
            headers: headers
        )
    } catch {
        print("Failed to bulk subscribe: \(error)")
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
4. Set up OpenAI API key in environment variables (`OPENAI_API_KEY`)
5. Run database migrations: `npm run prisma:deploy`
6. Build and start the service: `npm run build:app-notifications && npm run start:prod:app-notifications`

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
- **Microservice Communication**: Internal events use Redis-based microservice communication for secure inter-service messaging

## Architecture

The service operates as both an HTTP API and a microservice:

- **HTTP API**: Exposes REST endpoints for mobile apps and backend services
- **Microservice**: Listens for internal events via Redis (e.g., ranking estimation changes from data importer)
- **Event-Driven**: Automatically processes events and sends notifications to subscribed devices
- **AI Integration**: Uses OpenAI API for generating engaging, localized notification content 