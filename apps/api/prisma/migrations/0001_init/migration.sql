-- Earth Digital Twin AI — initial schema.
--
-- Hand written so we can express what Prisma's schema language cannot:
--   * PostGIS / pgcrypto / pg_trgm extensions
--   * GIST indexes on the geography columns
--   * GIN trigram indexes for fuzzy name search
--   * CHECK constraints (coordinate ranges, percentages, colour formats)
--   * triggers that derive `geom` from the portable `lng`/`lat` doubles
--
-- Everything else mirrors prisma/schema.prisma one-to-one. Two intentional,
-- additive differences: `id` columns also carry a `gen_random_uuid()` default
-- and `updated_at` carries `CURRENT_TIMESTAMP`, so raw SQL inserts made by ops
-- scripts are as safe as Prisma Client writes.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TYPE "user_role" AS ENUM ('user', 'analyst', 'admin', 'owner');
CREATE TYPE "user_status" AS ENUM ('active', 'suspended', 'unverified');
CREATE TYPE "subscription_plan" AS ENUM ('free', 'pro', 'team', 'enterprise');
CREATE TYPE "auth_provider" AS ENUM ('password', 'google', 'github');
CREATE TYPE "theme" AS ENUM ('dark', 'light', 'system');
CREATE TYPE "unit_system" AS ENUM ('metric', 'imperial');
CREATE TYPE "temperature_unit" AS ENUM ('celsius', 'fahrenheit');
CREATE TYPE "label_density" AS ENUM ('minimal', 'balanced', 'detailed');
CREATE TYPE "email_digest" AS ENUM ('off', 'daily', 'weekly');
CREATE TYPE "bookmark_kind" AS ENUM ('place', 'view', 'area', 'route');
CREATE TYPE "history_kind" AS ENUM ('search', 'place', 'report', 'ai', 'layer');
CREATE TYPE "workspace_visibility" AS ENUM ('private', 'team', 'public');
CREATE TYPE "workspace_role" AS ENUM ('viewer', 'editor', 'owner');
CREATE TYPE "annotation_kind" AS ENUM ('marker', 'line', 'polygon', 'circle', 'text', 'measure');
CREATE TYPE "report_kind" AS ENUM (
  'country_profile', 'city_profile', 'area_summary', 'environmental_risk',
  'climate_outlook', 'comparison', 'travel_plan', 'custom'
);
CREATE TYPE "report_status" AS ENUM ('queued', 'generating', 'ready', 'failed');
CREATE TYPE "report_format" AS ENUM ('markdown', 'pdf', 'docx');
CREATE TYPE "report_tone" AS ENUM ('executive', 'technical', 'academic', 'casual');
CREATE TYPE "notification_kind" AS ENUM ('hazard', 'report', 'system', 'ai', 'billing', 'security');
CREATE TYPE "notification_severity" AS ENUM ('info', 'success', 'warning', 'critical');
CREATE TYPE "notification_audience" AS ENUM ('all', 'free', 'pro', 'team', 'enterprise', 'admins');
CREATE TYPE "chat_role" AS ENUM ('system', 'user', 'assistant', 'tool');
CREATE TYPE "hazard_kind" AS ENUM (
  'earthquake', 'wildfire', 'volcano', 'flood', 'cyclone', 'drought', 'landslide', 'tsunami'
);
CREATE TYPE "hazard_severity" AS ENUM ('info', 'low', 'moderate', 'high', 'extreme');
CREATE TYPE "alert_channel" AS ENUM ('in_app', 'email', 'webhook');
CREATE TYPE "audit_outcome" AS ENUM ('success', 'failure');
CREATE TYPE "flag_audience" AS ENUM ('free', 'pro', 'team', 'enterprise', 'internal');
CREATE TYPE "attachment_kind" AS ENUM ('report_export', 'avatar', 'workspace_asset', 'data_import');
CREATE TYPE "continent" AS ENUM (
  'Africa', 'Antarctica', 'Asia', 'Europe', 'North America', 'Oceania', 'South America'
);
CREATE TYPE "driving_side" AS ENUM ('left', 'right');

-- ─────────────────────────────────────────────────────────────────────────────
-- Identity
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "users" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "password_hash" TEXT,
  "name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "role" "user_role" NOT NULL DEFAULT 'user',
  "plan" "subscription_plan" NOT NULL DEFAULT 'free',
  "status" "user_status" NOT NULL DEFAULT 'unverified',
  "organisation" TEXT,
  "job_title" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "email_verified_at" TIMESTAMP(3),
  "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
  "marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
  "accepted_terms_at" TIMESTAMP(3),
  "last_login_at" TIMESTAMP(3),
  "last_seen_at" TIMESTAMP(3),
  "failed_login_count" INTEGER NOT NULL DEFAULT 0,
  "locked_until" TIMESTAMP(3),
  "suspended_at" TIMESTAMP(3),
  "suspended_reason" TEXT,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email") AND length("email") BETWEEN 3 AND 254),
  CONSTRAINT "users_failed_login_count_check" CHECK ("failed_login_count" >= 0)
);
CREATE UNIQUE INDEX "users_email_key" ON "users" ("email");
CREATE INDEX "users_role_idx" ON "users" ("role");
CREATE INDEX "users_plan_idx" ON "users" ("plan");
CREATE INDEX "users_status_idx" ON "users" ("status");
CREATE INDEX "users_created_at_idx" ON "users" ("created_at");
CREATE INDEX "users_email_trgm_idx" ON "users" USING GIN ("email" gin_trgm_ops);
CREATE INDEX "users_name_trgm_idx" ON "users" USING GIN ("name" gin_trgm_ops);

CREATE TABLE "oauth_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "provider" "auth_provider" NOT NULL,
  "provider_account_id" TEXT NOT NULL,
  "email" TEXT,
  "display_name" TEXT,
  "avatar_url" TEXT,
  "scope" TEXT,
  "token_type" TEXT,
  "access_token_hash" TEXT,
  "refresh_token_hash" TEXT,
  "expires_at" TIMESTAMP(3),
  "last_login_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "oauth_accounts_provider_provider_account_id_key"
  ON "oauth_accounts" ("provider", "provider_account_id");
CREATE UNIQUE INDEX "oauth_accounts_user_id_provider_key" ON "oauth_accounts" ("user_id", "provider");
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts" ("user_id");

CREATE TABLE "refresh_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "session_id" UUID,
  "family_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "parent_id" UUID,
  "replaced_by_id" UUID,
  "used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "revoked_reason" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_tokens_expiry_check" CHECK ("expires_at" > "created_at")
);
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens" ("token_hash");
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" ("user_id");
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens" ("family_id");
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens" ("expires_at");

CREATE TABLE "password_reset_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "ip" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens" ("token_hash");
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens" ("user_id");
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens" ("expires_at");

CREATE TABLE "email_verification_tokens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens" ("token_hash");
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens" ("user_id");
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens" ("expires_at");

CREATE TABLE "mfa_secrets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "secret_encrypted" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL DEFAULT 'SHA1',
  "digits" INTEGER NOT NULL DEFAULT 6,
  "period" INTEGER NOT NULL DEFAULT 30,
  "recovery_hashes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "confirmed_at" TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3),
  "last_used_counter" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_secrets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mfa_secrets_digits_check" CHECK ("digits" BETWEEN 6 AND 8),
  CONSTRAINT "mfa_secrets_period_check" CHECK ("period" BETWEEN 15 AND 120)
);
CREATE UNIQUE INDEX "mfa_secrets_user_id_key" ON "mfa_secrets" ("user_id");

CREATE TABLE "user_preferences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "theme" "theme" NOT NULL DEFAULT 'dark',
  "units" "unit_system" NOT NULL DEFAULT 'metric',
  "temperature_unit" "temperature_unit" NOT NULL DEFAULT 'celsius',
  "map_basemap" TEXT NOT NULL DEFAULT 'satellite',
  "default_layers" TEXT[] NOT NULL DEFAULT ARRAY['borders', 'labels']::TEXT[],
  "reduced_motion" BOOLEAN NOT NULL DEFAULT false,
  "high_contrast" BOOLEAN NOT NULL DEFAULT false,
  "label_density" "label_density" NOT NULL DEFAULT 'balanced',
  "auto_rotate_globe" BOOLEAN NOT NULL DEFAULT true,
  "telemetry_opt_in" BOOLEAN NOT NULL DEFAULT true,
  "email_digest" "email_digest" NOT NULL DEFAULT 'weekly',
  "hazard_alert_radius_km" INTEGER NOT NULL DEFAULT 250,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_preferences_radius_check" CHECK ("hazard_alert_radius_km" BETWEEN 10 AND 5000)
);
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences" ("user_id");

CREATE TABLE "sessions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "ip" TEXT,
  "user_agent" TEXT,
  "device" TEXT,
  "browser" TEXT,
  "os" TEXT,
  "city" TEXT,
  "country_code" CHAR(2),
  "current" BOOLEAN NOT NULL DEFAULT false,
  "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_family_id_key" ON "sessions" ("family_id");
CREATE INDEX "sessions_user_id_last_active_at_idx" ON "sessions" ("user_id", "last_active_at");
CREATE INDEX "sessions_expires_at_idx" ON "sessions" ("expires_at");

-- ─────────────────────────────────────────────────────────────────────────────
-- Saved work
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "bookmark_collections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT NOT NULL DEFAULT '#818cf8',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookmark_collections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookmark_collections_color_check" CHECK ("color" ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT "bookmark_collections_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX "bookmark_collections_user_id_name_key" ON "bookmark_collections" ("user_id", "name");
CREATE INDEX "bookmark_collections_user_id_idx" ON "bookmark_collections" ("user_id");

CREATE TABLE "bookmarks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "collection_id" UUID,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "kind" "bookmark_kind" NOT NULL DEFAULT 'place',
  "lng" DOUBLE PRECISION NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "geom" geography(Point, 4326),
  "view" JSONB,
  "bbox_west" DOUBLE PRECISION,
  "bbox_south" DOUBLE PRECISION,
  "bbox_east" DOUBLE PRECISION,
  "bbox_north" DOUBLE PRECISION,
  "country_code" CHAR(2),
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "color" TEXT NOT NULL DEFAULT '#38bdf8',
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookmarks_lng_check" CHECK ("lng" BETWEEN -180 AND 180),
  CONSTRAINT "bookmarks_lat_check" CHECK ("lat" BETWEEN -90 AND 90),
  CONSTRAINT "bookmarks_color_check" CHECK ("color" ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT "bookmarks_bbox_check" CHECK (
    ("bbox_west" IS NULL AND "bbox_south" IS NULL AND "bbox_east" IS NULL AND "bbox_north" IS NULL)
    OR ("bbox_west" IS NOT NULL AND "bbox_south" IS NOT NULL AND "bbox_east" IS NOT NULL
        AND "bbox_north" IS NOT NULL AND "bbox_south" <= "bbox_north")
  )
);
CREATE INDEX "bookmarks_user_id_created_at_idx" ON "bookmarks" ("user_id", "created_at");
CREATE INDEX "bookmarks_collection_id_idx" ON "bookmarks" ("collection_id");
CREATE INDEX "bookmarks_country_code_idx" ON "bookmarks" ("country_code");
CREATE INDEX "bookmarks_user_id_pinned_idx" ON "bookmarks" ("user_id", "pinned");
CREATE INDEX "bookmarks_geom_gist_idx" ON "bookmarks" USING GIST ("geom");
CREATE INDEX "bookmarks_name_trgm_idx" ON "bookmarks" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "bookmarks_tags_gin_idx" ON "bookmarks" USING GIN ("tags");

CREATE TABLE "history_entries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "kind" "history_kind" NOT NULL,
  "label" TEXT NOT NULL,
  "detail" TEXT,
  "lng" DOUBLE PRECISION,
  "lat" DOUBLE PRECISION,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "history_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "history_entries_lng_check" CHECK ("lng" IS NULL OR "lng" BETWEEN -180 AND 180),
  CONSTRAINT "history_entries_lat_check" CHECK ("lat" IS NULL OR "lat" BETWEEN -90 AND 90)
);
CREATE INDEX "history_entries_user_id_created_at_idx" ON "history_entries" ("user_id", "created_at");
CREATE INDEX "history_entries_kind_idx" ON "history_entries" ("kind");
CREATE INDEX "history_entries_label_trgm_idx" ON "history_entries" USING GIN ("label" gin_trgm_ops);

CREATE TABLE "workspaces" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "view" JSONB NOT NULL,
  "layers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "visibility" "workspace_visibility" NOT NULL DEFAULT 'private',
  "share_slug" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workspaces_name_check" CHECK (length(btrim("name")) BETWEEN 1 AND 120)
);
CREATE UNIQUE INDEX "workspaces_share_slug_key" ON "workspaces" ("share_slug");
CREATE INDEX "workspaces_owner_id_updated_at_idx" ON "workspaces" ("owner_id", "updated_at");
CREATE INDEX "workspaces_visibility_idx" ON "workspaces" ("visibility");
CREATE INDEX "workspaces_name_trgm_idx" ON "workspaces" USING GIN ("name" gin_trgm_ops);

CREATE TABLE "workspace_members" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "workspace_role" NOT NULL DEFAULT 'viewer',
  "invited_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workspace_members_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key"
  ON "workspace_members" ("workspace_id", "user_id");
CREATE INDEX "workspace_members_user_id_idx" ON "workspace_members" ("user_id");

CREATE TABLE "annotations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "workspace_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "kind" "annotation_kind" NOT NULL,
  "label" TEXT NOT NULL DEFAULT '',
  "color" TEXT NOT NULL DEFAULT '#22d3ee',
  "coordinates" JSONB NOT NULL,
  "radius_m" DOUBLE PRECISION,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "annotations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "annotations_color_check" CHECK ("color" ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT "annotations_radius_check" CHECK ("radius_m" IS NULL OR "radius_m" > 0),
  CONSTRAINT "annotations_coordinates_check" CHECK (jsonb_typeof("coordinates") = 'array')
);
CREATE INDEX "annotations_workspace_id_idx" ON "annotations" ("workspace_id");
CREATE INDEX "annotations_created_by_id_idx" ON "annotations" ("created_by_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- Reports
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "report_kind" NOT NULL,
  "status" "report_status" NOT NULL DEFAULT 'queued',
  "format" "report_format" NOT NULL DEFAULT 'markdown',
  "tone" "report_tone" NOT NULL DEFAULT 'executive',
  "include_charts" BOOLEAN NOT NULL DEFAULT true,
  "content" TEXT,
  "summary" TEXT,
  "target" JSONB NOT NULL,
  "tokens_used" INTEGER,
  "generation_ms" INTEGER,
  "error" TEXT,
  "job_id" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reports_tokens_check" CHECK ("tokens_used" IS NULL OR "tokens_used" >= 0),
  CONSTRAINT "reports_generation_ms_check" CHECK ("generation_ms" IS NULL OR "generation_ms" >= 0),
  CONSTRAINT "reports_terminal_state_check" CHECK (
    ("status" <> 'ready') OR ("completed_at" IS NOT NULL)
  )
);
CREATE INDEX "reports_user_id_created_at_idx" ON "reports" ("user_id", "created_at");
CREATE INDEX "reports_status_idx" ON "reports" ("status");
CREATE INDEX "reports_kind_idx" ON "reports" ("kind");
CREATE INDEX "reports_title_trgm_idx" ON "reports" USING GIN ("title" gin_trgm_ops);

CREATE TABLE "report_sections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "heading" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "charts" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "report_sections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "report_sections_position_check" CHECK ("position" >= 0)
);
CREATE UNIQUE INDEX "report_sections_report_id_position_key" ON "report_sections" ("report_id", "position");

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "kind" "notification_kind" NOT NULL DEFAULT 'system',
  "severity" "notification_severity" NOT NULL DEFAULT 'info',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "action_url" TEXT,
  "audience" "notification_audience",
  "read_at" TIMESTAMP(3),
  "scheduled_for" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_target_check" CHECK ("user_id" IS NOT NULL OR "audience" IS NOT NULL)
);
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" ("user_id", "created_at");
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications" ("user_id", "read_at");
CREATE INDEX "notifications_kind_idx" ON "notifications" ("kind");
CREATE INDEX "notifications_scheduled_for_idx" ON "notifications" ("scheduled_for");

CREATE TABLE "notification_preferences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "channel_in_app" BOOLEAN NOT NULL DEFAULT true,
  "channel_email" BOOLEAN NOT NULL DEFAULT true,
  "channel_webhook" BOOLEAN NOT NULL DEFAULT false,
  "webhook_url" TEXT,
  "hazard_min_severity" "hazard_severity" NOT NULL DEFAULT 'high',
  "digest" "email_digest" NOT NULL DEFAULT 'weekly',
  "quiet_hours_start" INTEGER,
  "quiet_hours_end" INTEGER,
  "muted_kinds" "notification_kind"[] NOT NULL DEFAULT ARRAY[]::"notification_kind"[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notification_preferences_quiet_start_check"
    CHECK ("quiet_hours_start" IS NULL OR "quiet_hours_start" BETWEEN 0 AND 23),
  CONSTRAINT "notification_preferences_quiet_end_check"
    CHECK ("quiet_hours_end" IS NULL OR "quiet_hours_end" BETWEEN 0 AND 23),
  CONSTRAINT "notification_preferences_webhook_check"
    CHECK ("channel_webhook" = false OR "webhook_url" IS NOT NULL)
);
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences" ("user_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- AI
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL DEFAULT 'New conversation',
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "message_count" INTEGER NOT NULL DEFAULT 0,
  "last_message_preview" TEXT,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversations_message_count_check" CHECK ("message_count" >= 0)
);
CREATE INDEX "conversations_user_id_updated_at_idx" ON "conversations" ("user_id", "updated_at");
CREATE INDEX "conversations_title_trgm_idx" ON "conversations" USING GIN ("title" gin_trgm_ops);

CREATE TABLE "chat_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "role" "chat_role" NOT NULL,
  "content" TEXT NOT NULL,
  "intent" TEXT,
  "citations" JSONB,
  "actions" JSONB,
  "tool_calls" JSONB,
  "tokens_used" INTEGER,
  "latency_ms" INTEGER,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_messages_tokens_check" CHECK ("tokens_used" IS NULL OR "tokens_used" >= 0)
);
CREATE INDEX "chat_messages_conversation_id_created_at_idx" ON "chat_messages" ("conversation_id", "created_at");

CREATE TABLE "ai_usage_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "conversation_id" UUID,
  "model" TEXT NOT NULL,
  "intent" TEXT,
  "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
  "completion_tokens" INTEGER NOT NULL DEFAULT 0,
  "total_tokens" INTEGER NOT NULL DEFAULT 0,
  "latency_ms" INTEGER NOT NULL DEFAULT 0,
  "cost_usd" DECIMAL(12, 6),
  "ok" BOOLEAN NOT NULL DEFAULT true,
  "error_code" TEXT,
  "flagged" BOOLEAN NOT NULL DEFAULT false,
  "request_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_usage_logs_tokens_check" CHECK (
    "prompt_tokens" >= 0 AND "completion_tokens" >= 0 AND "total_tokens" >= 0
  ),
  CONSTRAINT "ai_usage_logs_latency_check" CHECK ("latency_ms" >= 0),
  CONSTRAINT "ai_usage_logs_cost_check" CHECK ("cost_usd" IS NULL OR "cost_usd" >= 0)
);
CREATE INDEX "ai_usage_logs_created_at_idx" ON "ai_usage_logs" ("created_at");
CREATE INDEX "ai_usage_logs_user_id_created_at_idx" ON "ai_usage_logs" ("user_id", "created_at");
CREATE INDEX "ai_usage_logs_flagged_idx" ON "ai_usage_logs" ("flagged");

-- ─────────────────────────────────────────────────────────────────────────────
-- Reference gazetteer
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "countries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" CHAR(2) NOT NULL,
  "code3" CHAR(3) NOT NULL,
  "numeric" CHAR(3),
  "name" TEXT NOT NULL,
  "official_name" TEXT NOT NULL,
  "continent" "continent" NOT NULL,
  "region" TEXT,
  "subregion" TEXT,
  "capital" TEXT,
  "population" BIGINT NOT NULL DEFAULT 0,
  "population_year" INTEGER,
  "area_km2" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "flag_emoji" TEXT NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "capital_lng" DOUBLE PRECISION,
  "capital_lat" DOUBLE PRECISION,
  "geom" geography(Point, 4326),
  "bbox_west" DOUBLE PRECISION,
  "bbox_south" DOUBLE PRECISION,
  "bbox_east" DOUBLE PRECISION,
  "bbox_north" DOUBLE PRECISION,
  "currencies" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "languages" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "timezones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "calling_codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tld" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "driving_side" "driving_side",
  "independent" BOOLEAN NOT NULL DEFAULT true,
  "un_member" BOOLEAN NOT NULL DEFAULT true,
  "landlocked" BOOLEAN NOT NULL DEFAULT false,
  "borders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "demonym" TEXT,
  "income_group" TEXT,
  "alt_spellings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "flag_svg_url" TEXT NOT NULL,
  "coat_of_arms_url" TEXT,
  "maps_url" TEXT,
  "wikipedia_url" TEXT,
  "summary" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "countries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "countries_code_format_check" CHECK ("code" ~ '^[A-Z]{2}$'),
  CONSTRAINT "countries_code3_format_check" CHECK ("code3" ~ '^[A-Z]{3}$'),
  CONSTRAINT "countries_lng_check" CHECK ("lng" BETWEEN -180 AND 180),
  CONSTRAINT "countries_lat_check" CHECK ("lat" BETWEEN -90 AND 90),
  CONSTRAINT "countries_population_check" CHECK ("population" >= 0),
  CONSTRAINT "countries_area_check" CHECK ("area_km2" >= 0)
);
CREATE UNIQUE INDEX "countries_code_key" ON "countries" ("code");
CREATE UNIQUE INDEX "countries_code3_key" ON "countries" ("code3");
CREATE INDEX "countries_continent_idx" ON "countries" ("continent");
CREATE INDEX "countries_name_idx" ON "countries" ("name");
CREATE INDEX "countries_population_idx" ON "countries" ("population");
CREATE INDEX "countries_geom_gist_idx" ON "countries" USING GIST ("geom");
CREATE INDEX "countries_name_trgm_idx" ON "countries" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "countries_official_name_trgm_idx" ON "countries" USING GIN ("official_name" gin_trgm_ops);

CREATE TABLE "country_indicators" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "country_id" UUID NOT NULL,
  "indicator" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL DEFAULT 'World Bank',
  "year" INTEGER NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "country_indicators_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "country_indicators_year_check" CHECK ("year" BETWEEN 1900 AND 2100)
);
CREATE UNIQUE INDEX "country_indicators_country_id_indicator_year_key"
  ON "country_indicators" ("country_id", "indicator", "year");
CREATE INDEX "country_indicators_indicator_year_idx" ON "country_indicators" ("indicator", "year");

CREATE TABLE "cities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "geoname_id" INTEGER,
  "country_id" UUID NOT NULL,
  "country_code" CHAR(2) NOT NULL,
  "name" TEXT NOT NULL,
  "ascii_name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "admin1" TEXT,
  "admin2" TEXT,
  "population" INTEGER NOT NULL DEFAULT 0,
  "lng" DOUBLE PRECISION NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "geom" geography(Point, 4326),
  "elevation_m" INTEGER,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "is_capital" BOOLEAN NOT NULL DEFAULT false,
  "metro_population" INTEGER,
  "area_km2" DOUBLE PRECISION,
  "population_density" DOUBLE PRECISION,
  "founded_year" INTEGER,
  "gdp_usd" BIGINT,
  "cost_of_living_index" DOUBLE PRECISION,
  "quality_of_life_index" DOUBLE PRECISION,
  "safety_index" DOUBLE PRECISION,
  "transit_score" DOUBLE PRECISION,
  "walk_score" DOUBLE PRECISION,
  "average_temperature" DOUBLE PRECISION,
  "average_aqi" DOUBLE PRECISION,
  "nearest_airports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sister_cities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "wikipedia_url" TEXT,
  "summary" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cities_lng_check" CHECK ("lng" BETWEEN -180 AND 180),
  CONSTRAINT "cities_lat_check" CHECK ("lat" BETWEEN -90 AND 90),
  CONSTRAINT "cities_population_check" CHECK ("population" >= 0),
  CONSTRAINT "cities_metro_population_check" CHECK ("metro_population" IS NULL OR "metro_population" >= 0),
  CONSTRAINT "cities_country_code_format_check" CHECK ("country_code" ~ '^[A-Z]{2}$')
);
CREATE UNIQUE INDEX "cities_geoname_id_key" ON "cities" ("geoname_id");
CREATE UNIQUE INDEX "cities_country_code_slug_key" ON "cities" ("country_code", "slug");
CREATE INDEX "cities_country_code_idx" ON "cities" ("country_code");
CREATE INDEX "cities_name_idx" ON "cities" ("name");
CREATE INDEX "cities_population_idx" ON "cities" ("population");
CREATE INDEX "cities_is_capital_idx" ON "cities" ("is_capital");
CREATE INDEX "cities_geom_gist_idx" ON "cities" USING GIST ("geom");
CREATE INDEX "cities_name_trgm_idx" ON "cities" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "cities_ascii_name_trgm_idx" ON "cities" USING GIN ("ascii_name" gin_trgm_ops);

CREATE TABLE "city_metrics" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "city_id" UUID NOT NULL,
  "metric" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT '',
  "source" TEXT NOT NULL DEFAULT 'Earth Digital Twin',
  "period" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "city_metrics_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "city_metrics_city_id_metric_period_key"
  ON "city_metrics" ("city_id", "metric", "period");
CREATE INDEX "city_metrics_metric_idx" ON "city_metrics" ("metric");

CREATE TABLE "airports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "icao" CHAR(4) NOT NULL,
  "iata" CHAR(3),
  "name" TEXT NOT NULL,
  "city" TEXT,
  "country_code" CHAR(2) NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "elevation_m" INTEGER,
  "timezone" TEXT,
  "passengers" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "airports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "airports_lng_check" CHECK ("lng" BETWEEN -180 AND 180),
  CONSTRAINT "airports_lat_check" CHECK ("lat" BETWEEN -90 AND 90),
  CONSTRAINT "airports_passengers_check" CHECK ("passengers" IS NULL OR "passengers" >= 0)
);
CREATE UNIQUE INDEX "airports_icao_key" ON "airports" ("icao");
CREATE INDEX "airports_country_code_idx" ON "airports" ("country_code");
CREATE INDEX "airports_iata_idx" ON "airports" ("iata");
CREATE INDEX "airports_name_idx" ON "airports" ("name");
CREATE INDEX "airports_name_trgm_idx" ON "airports" USING GIN ("name" gin_trgm_ops);

CREATE TABLE "seaports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "country_code" CHAR(2) NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "teu" BIGINT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seaports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seaports_lng_check" CHECK ("lng" BETWEEN -180 AND 180),
  CONSTRAINT "seaports_lat_check" CHECK ("lat" BETWEEN -90 AND 90),
  CONSTRAINT "seaports_teu_check" CHECK ("teu" IS NULL OR "teu" >= 0)
);
CREATE UNIQUE INDEX "seaports_code_key" ON "seaports" ("code");
CREATE INDEX "seaports_country_code_idx" ON "seaports" ("country_code");
CREATE INDEX "seaports_name_idx" ON "seaports" ("name");
CREATE INDEX "seaports_name_trgm_idx" ON "seaports" USING GIN ("name" gin_trgm_ops);

CREATE TABLE "hazard_event_cache" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "external_id" TEXT NOT NULL,
  "kind" "hazard_kind" NOT NULL,
  "title" TEXT NOT NULL,
  "severity" "hazard_severity" NOT NULL,
  "intensity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "lng" DOUBLE PRECISION NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "depth_km" DOUBLE PRECISION,
  "magnitude" DOUBLE PRECISION,
  "frp_mw" DOUBLE PRECISION,
  "affected_population" INTEGER,
  "place" TEXT,
  "country_code" CHAR(2),
  "tsunami_warning" BOOLEAN NOT NULL DEFAULT false,
  "source" TEXT NOT NULL,
  "source_url" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL,
  "source_updated_at" TIMESTAMP(3) NOT NULL,
  "notified_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "raw" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hazard_event_cache_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hazard_event_cache_lng_check" CHECK ("lng" BETWEEN -180 AND 180),
  CONSTRAINT "hazard_event_cache_lat_check" CHECK ("lat" BETWEEN -90 AND 90),
  CONSTRAINT "hazard_event_cache_intensity_check" CHECK ("intensity" BETWEEN 0 AND 1),
  CONSTRAINT "hazard_event_cache_magnitude_check"
    CHECK ("magnitude" IS NULL OR "magnitude" BETWEEN -2 AND 12)
);
CREATE UNIQUE INDEX "hazard_event_cache_external_id_key" ON "hazard_event_cache" ("external_id");
CREATE INDEX "hazard_event_cache_kind_started_at_idx" ON "hazard_event_cache" ("kind", "started_at");
CREATE INDEX "hazard_event_cache_severity_started_at_idx" ON "hazard_event_cache" ("severity", "started_at");
CREATE INDEX "hazard_event_cache_expires_at_idx" ON "hazard_event_cache" ("expires_at");
CREATE INDEX "hazard_event_cache_notified_at_idx" ON "hazard_event_cache" ("notified_at");
CREATE INDEX "hazard_event_cache_title_trgm_idx" ON "hazard_event_cache" USING GIN ("title" gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- Platform operations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "feature_flags" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "rollout" INTEGER NOT NULL DEFAULT 0,
  "audience" "flag_audience"[] NOT NULL DEFAULT ARRAY['internal']::"flag_audience"[],
  "updated_by_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "feature_flags_key_format_check" CHECK ("key" ~ '^[a-z0-9_.-]{3,64}$'),
  CONSTRAINT "feature_flags_rollout_check" CHECK ("rollout" BETWEEN 0 AND 100)
);
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags" ("key");
CREATE INDEX "feature_flags_enabled_idx" ON "feature_flags" ("enabled");

CREATE TABLE "api_keys" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "suffix" VARCHAR(8) NOT NULL,
  "key_hash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 120,
  "usage_count" BIGINT NOT NULL DEFAULT 0,
  "last_used_at" TIMESTAMP(3),
  "last_used_ip" TEXT,
  "rotated_from_id" UUID,
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_keys_rate_limit_check" CHECK ("rate_limit_per_minute" BETWEEN 1 AND 10000),
  CONSTRAINT "api_keys_usage_count_check" CHECK ("usage_count" >= 0)
);
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys" ("key_hash");
CREATE INDEX "api_keys_owner_id_idx" ON "api_keys" ("owner_id");
CREATE INDEX "api_keys_revoked_at_idx" ON "api_keys" ("revoked_at");

CREATE TABLE "audit_logs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actor_id" UUID,
  "actor_email" TEXT,
  "action" TEXT NOT NULL,
  "resource" TEXT NOT NULL,
  "resource_id" TEXT,
  "ip" TEXT,
  "user_agent" TEXT,
  "outcome" "audit_outcome" NOT NULL DEFAULT 'success',
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "request_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs" ("actor_id", "created_at");
CREATE INDEX "audit_logs_resource_created_at_idx" ON "audit_logs" ("resource", "created_at");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" ("action");

CREATE TABLE "usage_metrics" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "scope" TEXT NOT NULL DEFAULT 'global',
  "bucket" TIMESTAMP(3) NOT NULL,
  "requests" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "p95_latency_ms" INTEGER NOT NULL DEFAULT 0,
  "ai_tokens" INTEGER NOT NULL DEFAULT 0,
  "unique_users" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_metrics_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "usage_metrics_non_negative_check" CHECK (
    "requests" >= 0 AND "errors" >= 0 AND "p95_latency_ms" >= 0
    AND "ai_tokens" >= 0 AND "unique_users" >= 0
  ),
  CONSTRAINT "usage_metrics_errors_bound_check" CHECK ("errors" <= "requests")
);
CREATE UNIQUE INDEX "usage_metrics_scope_bucket_key" ON "usage_metrics" ("scope", "bucket");
CREATE INDEX "usage_metrics_bucket_idx" ON "usage_metrics" ("bucket");

CREATE TABLE "saved_searches" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "filters" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "notify" BOOLEAN NOT NULL DEFAULT false,
  "last_run_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "saved_searches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "saved_searches_query_check" CHECK (length(btrim("query")) BETWEEN 1 AND 160)
);
CREATE UNIQUE INDEX "saved_searches_user_id_name_key" ON "saved_searches" ("user_id", "name");
CREATE INDEX "saved_searches_user_id_idx" ON "saved_searches" ("user_id");

CREATE TABLE "alerts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "kinds" "hazard_kind"[] NOT NULL DEFAULT ARRAY[]::"hazard_kind"[],
  "min_severity" "hazard_severity" NOT NULL DEFAULT 'moderate',
  "lng" DOUBLE PRECISION NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "radius_km" DOUBLE PRECISION NOT NULL DEFAULT 250,
  "geom" geography(Point, 4326),
  "channels" "alert_channel"[] NOT NULL DEFAULT ARRAY['in_app']::"alert_channel"[],
  "webhook_url" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "trigger_count" INTEGER NOT NULL DEFAULT 0,
  "last_triggered_at" TIMESTAMP(3),
  "mute_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "alerts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "alerts_lng_check" CHECK ("lng" BETWEEN -180 AND 180),
  CONSTRAINT "alerts_lat_check" CHECK ("lat" BETWEEN -90 AND 90),
  CONSTRAINT "alerts_radius_check" CHECK ("radius_km" > 0 AND "radius_km" <= 20000),
  CONSTRAINT "alerts_trigger_count_check" CHECK ("trigger_count" >= 0),
  CONSTRAINT "alerts_webhook_check" CHECK (
    NOT ('webhook' = ANY ("channels")) OR "webhook_url" IS NOT NULL
  )
);
CREATE UNIQUE INDEX "alerts_user_id_name_key" ON "alerts" ("user_id", "name");
CREATE INDEX "alerts_user_id_idx" ON "alerts" ("user_id");
CREATE INDEX "alerts_active_idx" ON "alerts" ("active");
CREATE INDEX "alerts_geom_gist_idx" ON "alerts" USING GIST ("geom");

CREATE TABLE "attachments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "owner_id" UUID NOT NULL,
  "report_id" UUID,
  "workspace_id" UUID,
  "kind" "attachment_kind" NOT NULL DEFAULT 'report_export',
  "filename" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "storage_key" TEXT NOT NULL,
  "checksum" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attachments_size_check" CHECK ("size_bytes" >= 0)
);
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments" ("storage_key");
CREATE INDEX "attachments_owner_id_idx" ON "attachments" ("owner_id");
CREATE INDEX "attachments_report_id_idx" ON "attachments" ("report_id");
CREATE INDEX "attachments_workspace_id_idx" ON "attachments" ("workspace_id");

-- ─────────────────────────────────────────────────────────────────────────────
-- Foreign keys
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_secrets" ADD CONSTRAINT "mfa_secrets_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookmark_collections" ADD CONSTRAINT "bookmark_collections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_collection_id_fkey"
  FOREIGN KEY ("collection_id") REFERENCES "bookmark_collections" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "history_entries" ADD CONSTRAINT "history_entries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_invited_by_id_fkey"
  FOREIGN KEY ("invited_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_sections" ADD CONSTRAINT "report_sections_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_usage_logs" ADD CONSTRAINT "ai_usage_logs_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "country_indicators" ADD CONSTRAINT "country_indicators_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cities" ADD CONSTRAINT "cities_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "city_metrics" ADD CONSTRAINT "city_metrics_city_id_fkey"
  FOREIGN KEY ("city_id") REFERENCES "cities" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_updated_by_id_fkey"
  FOREIGN KEY ("updated_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "reports" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Keep the PostGIS geography columns in sync with the portable lng/lat doubles.
-- Prisma Client writes lng/lat; the trigger derives geom so spatial indexes and
-- ST_DWithin queries stay correct without the application knowing about PostGIS.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION "set_geog_from_lnglat"() RETURNS trigger AS $$
BEGIN
  IF NEW."lng" IS NULL OR NEW."lat" IS NULL THEN
    NEW."geom" := NULL;
  ELSE
    NEW."geom" := ST_SetSRID(ST_MakePoint(NEW."lng", NEW."lat"), 4326)::geography;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "countries_geom_sync" BEFORE INSERT OR UPDATE OF "lng", "lat" ON "countries"
  FOR EACH ROW EXECUTE FUNCTION "set_geog_from_lnglat"();
CREATE TRIGGER "cities_geom_sync" BEFORE INSERT OR UPDATE OF "lng", "lat" ON "cities"
  FOR EACH ROW EXECUTE FUNCTION "set_geog_from_lnglat"();
CREATE TRIGGER "bookmarks_geom_sync" BEFORE INSERT OR UPDATE OF "lng", "lat" ON "bookmarks"
  FOR EACH ROW EXECUTE FUNCTION "set_geog_from_lnglat"();
CREATE TRIGGER "alerts_geom_sync" BEFORE INSERT OR UPDATE OF "lng", "lat" ON "alerts"
  FOR EACH ROW EXECUTE FUNCTION "set_geog_from_lnglat"();
