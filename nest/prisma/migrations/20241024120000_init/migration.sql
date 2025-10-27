-- CreateEnum
CREATE TYPE "device_kind" AS ENUM ('heat', 'fan', 'btsp', 'light-red', 'light-green', 'light-blue', 'light-white', 'display');

-- CreateTable
CREATE TABLE "bbox_history" (
    "id" BIGSERIAL NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bboxes" JSONB NOT NULL,
    "frame_count" INTEGER,
    "camera_id" TEXT,

    CONSTRAINT "bbox_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "heatmap_hour" (
    "hour_ts" TIMESTAMPTZ NOT NULL,
    "gx" INTEGER NOT NULL,
    "gy" INTEGER NOT NULL,
    "hits" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "heatmap_hour_pkey" PRIMARY KEY ("hour_ts","gx","gy")
);

-- CreateTable
CREATE TABLE "device_usage" (
    "id" BIGSERIAL NOT NULL,
    "ts" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "device_type" "device_kind" NOT NULL,
    "action" TEXT,
    "value" REAL,

    CONSTRAINT "device_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_usage_hour" (
    "hour_ts" TIMESTAMPTZ NOT NULL,
    "device_type" "device_kind" NOT NULL,
    "events" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "device_usage_hour_pkey" PRIMARY KEY ("hour_ts","device_type")
);

-- CreateIndex
CREATE INDEX "bbox_history_ts_idx" ON "bbox_history"("ts");

-- CreateIndex
CREATE INDEX "heatmap_hour_hour_ts_idx" ON "heatmap_hour"("hour_ts");

-- CreateIndex
CREATE INDEX "device_usage_device_type_ts_idx" ON "device_usage"("device_type", "ts");

-- CreateIndex
CREATE INDEX "device_usage_ts_idx" ON "device_usage"("ts");

