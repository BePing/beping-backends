-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DELIVERED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CUSTOM';

-- CreateTable
CREATE TABLE "DeviceSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "deviceToken" TEXT NOT NULL,
    "platform" "DevicePlatform" NOT NULL,
    "appVersion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notificationTypes" "NotificationType"[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "deviceSubscriptionId" TEXT,
    "notificationType" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "fcmMessageId" TEXT,
    "status" "NotificationStatus" NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSubscription_deviceToken_key" ON "DeviceSubscription"("deviceToken");

-- CreateIndex
CREATE INDEX "DeviceSubscription_userId_idx" ON "DeviceSubscription"("userId");

-- CreateIndex
CREATE INDEX "DeviceSubscription_active_idx" ON "DeviceSubscription"("active");

-- CreateIndex
CREATE INDEX "DeviceSubscription_platform_idx" ON "DeviceSubscription"("platform");

-- CreateIndex
CREATE INDEX "NotificationLog_notificationType_idx" ON "NotificationLog"("notificationType");

-- CreateIndex
CREATE INDEX "NotificationLog_status_idx" ON "NotificationLog"("status");

-- CreateIndex
CREATE INDEX "NotificationLog_sentAt_idx" ON "NotificationLog"("sentAt");

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_deviceSubscriptionId_fkey" FOREIGN KEY ("deviceSubscriptionId") REFERENCES "DeviceSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
