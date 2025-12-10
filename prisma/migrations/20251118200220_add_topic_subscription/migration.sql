-- CreateTable
CREATE TABLE "TopicSubscription" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "deviceSubscriptionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TopicSubscription_topic_idx" ON "TopicSubscription"("topic");

-- CreateIndex
CREATE UNIQUE INDEX "TopicSubscription_deviceSubscriptionId_topic_key" ON "TopicSubscription"("deviceSubscriptionId", "topic");

-- AddForeignKey
ALTER TABLE "TopicSubscription" ADD CONSTRAINT "TopicSubscription_deviceSubscriptionId_fkey" FOREIGN KEY ("deviceSubscriptionId") REFERENCES "DeviceSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
