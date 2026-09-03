CREATE TYPE "public"."badge_format" AS ENUM('lanyard', 'wristband', 'sticker');--> statement-breakpoint
CREATE TYPE "public"."calendar_provider" AS ENUM('google', 'outlook', 'apple');--> statement-breakpoint
CREATE TYPE "public"."calendar_sync_status" AS ENUM('pending', 'synced', 'failed', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."check_in_method" AS ENUM('qr', 'search', 'walkin');--> statement-breakpoint
CREATE TYPE "public"."consent_type" AS ENUM('pdpa', 'photo', 'terms', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'failed', 'bounced', 'complained');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('draft', 'published', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."link_action" AS ENUM('click', 'view_form', 'share', 'copy_link');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('logo', 'poster', 'banner', 'speaker', 'sponsor', 'badge_background', 'gallery', 'og_image');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('text', 'dropdown', 'radio', 'checkbox', 'consent');--> statement-breakpoint
CREATE TYPE "public"."registration_source" AS ENUM('online', 'walkin', 'admin_manual');--> statement-breakpoint
CREATE TYPE "public"."registration_status" AS ENUM('confirmed', 'cancelled', 'waitlist', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('valid', 'used', 'void');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'staff', 'viewer');--> statement-breakpoint
CREATE TABLE "event_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"name_th" varchar(100) NOT NULL,
	"name_en" varchar(100),
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"quota" integer NOT NULL,
	"reserved_count" integer DEFAULT 0 NOT NULL,
	"checked_in_count" integer DEFAULT 0 NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(80) NOT NULL,
	"name_th" varchar(200) NOT NULL,
	"name_en" varchar(200),
	"description_th" text,
	"description_en" text,
	"category" varchar(60),
	"venue_name" text,
	"venue_address" text,
	"venue_lat" numeric(10, 7),
	"venue_lng" numeric(10, 7),
	"map_url" text,
	"travel_note" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"timezone" varchar(40) DEFAULT 'Asia/Bangkok' NOT NULL,
	"registration_opens_at" timestamp with time zone,
	"registration_closes_at" timestamp with time zone,
	"status" "event_status" DEFAULT 'draft' NOT NULL,
	"allow_walkin_over_quota" boolean DEFAULT true NOT NULL,
	"waitlist_enabled" boolean DEFAULT true NOT NULL,
	"seat_hold_minutes" integer DEFAULT 15 NOT NULL,
	"theme_color" varchar(7) DEFAULT '#EC5F27' NOT NULL,
	"organizer_name" varchar(200),
	"organizer_phone" varchar(40),
	"organizer_email" varchar(255),
	"organizer_line_id" varchar(80),
	"privacy_policy_version" varchar(20) DEFAULT '1.0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"value" varchar(80) NOT NULL,
	"label_th" text NOT NULL,
	"label_en" text,
	"is_other" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"key" varchar(60) NOT NULL,
	"label_th" text NOT NULL,
	"label_en" text,
	"helper_text_th" text,
	"helper_text_en" text,
	"type" "question_type" NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"min_select" integer,
	"max_select" integer,
	"has_other_option" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"can_scan" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"totp_secret" varchar(255),
	"last_login_at" timestamp with time zone,
	"failed_login_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"registration_id" uuid NOT NULL,
	"type" "consent_type" NOT NULL,
	"is_granted" boolean NOT NULL,
	"policy_version" varchar(20) NOT NULL,
	"consented_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" varchar(64),
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "registration_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"option_id" uuid,
	"value_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "registration_sessions" (
	"registration_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "registration_sessions_registration_id_session_id_pk" PRIMARY KEY("registration_id","session_id")
);
--> statement-breakpoint
CREATE TABLE "registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"registration_code" varchar(10) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"phone_country_code" varchar(5) DEFAULT '+66' NOT NULL,
	"occupation" varchar(120),
	"occupation_other" varchar(200),
	"status" "registration_status" DEFAULT 'confirmed' NOT NULL,
	"source" "registration_source" DEFAULT 'online' NOT NULL,
	"share_link_id" uuid,
	"utm_source" varchar(100),
	"utm_medium" varchar(100),
	"utm_campaign" varchar(100),
	"locale" varchar(5) DEFAULT 'th' NOT NULL,
	"ip_hash" varchar(64),
	"user_agent" text,
	"save_for_next_time" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seat_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"hold_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"converted_registration_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badge_prints" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"staff_user_id" uuid,
	"format" "badge_format" DEFAULT 'lanyard' NOT NULL,
	"is_reprint" boolean DEFAULT false NOT NULL,
	"printed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_ins" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ticket_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"staff_user_id" uuid,
	"checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
	"synced_at" timestamp with time zone,
	"method" "check_in_method" DEFAULT 'qr' NOT NULL,
	"device_id" varchar(80),
	"is_offline_sync" boolean DEFAULT false NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"ticket_code" varchar(20) NOT NULL,
	"qr_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"ticket_type" varchar(50) DEFAULT 'Free' NOT NULL,
	"holder_first_name" varchar(100) NOT NULL,
	"holder_last_name" varchar(100) NOT NULL,
	"holder_email" varchar(255) NOT NULL,
	"status" "ticket_status" DEFAULT 'valid' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"type" "media_type" NOT NULL,
	"original_url" text NOT NULL,
	"webp_url" text,
	"avif_url" text,
	"variants" jsonb,
	"mime_type" varchar(60) NOT NULL,
	"width" integer,
	"height" integer,
	"size_bytes" integer,
	"alt_text_th" text,
	"alt_text_en" text,
	"caption_th" text,
	"caption_en" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"share_link_id" uuid,
	"event_id" uuid NOT NULL,
	"action" "link_action" NOT NULL,
	"platform" varchar(40),
	"source_page" varchar(60),
	"sharer_registration_id" uuid,
	"visitor_hash" varchar(64),
	"referrer" text,
	"user_agent" text,
	"device_type" varchar(20),
	"country" varchar(2),
	"ip_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"code" varchar(20) NOT NULL,
	"label" varchar(120) NOT NULL,
	"channel" varchar(80),
	"medium" varchar(80),
	"campaign" varchar(80),
	"target_path" text DEFAULT '/' NOT NULL,
	"qr_image_url" text,
	"click_count" integer DEFAULT 0 NOT NULL,
	"unique_count" integer DEFAULT 0 NOT NULL,
	"conversion_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"action" varchar(60) NOT NULL,
	"entity_type" varchar(60),
	"entity_id" varchar(80),
	"before_json" jsonb,
	"after_json" jsonb,
	"ip_hash" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_syncs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid NOT NULL,
	"provider" "calendar_provider" NOT NULL,
	"external_event_id" varchar(255),
	"status" "calendar_sync_status" DEFAULT 'pending' NOT NULL,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"last_synced_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"registration_id" uuid,
	"to_email" varchar(255) NOT NULL,
	"template" varchar(60) NOT NULL,
	"provider" varchar(40),
	"provider_message_id" varchar(200),
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "event_sessions" ADD CONSTRAINT "event_sessions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_options" ADD CONSTRAINT "form_options_question_id_form_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."form_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_questions" ADD CONSTRAINT "form_questions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_answers" ADD CONSTRAINT "registration_answers_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_answers" ADD CONSTRAINT "registration_answers_question_id_form_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."form_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_answers" ADD CONSTRAINT "registration_answers_option_id_form_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."form_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_sessions" ADD CONSTRAINT "registration_sessions_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_sessions" ADD CONSTRAINT "registration_sessions_session_id_event_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_share_link_id_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_session_id_event_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seat_holds" ADD CONSTRAINT "seat_holds_converted_registration_id_registrations_id_fk" FOREIGN KEY ("converted_registration_id") REFERENCES "public"."registrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_prints" ADD CONSTRAINT "badge_prints_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "badge_prints" ADD CONSTRAINT "badge_prints_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_session_id_event_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."event_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_staff_user_id_users_id_fk" FOREIGN KEY ("staff_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_events" ADD CONSTRAINT "link_events_share_link_id_share_links_id_fk" FOREIGN KEY ("share_link_id") REFERENCES "public"."share_links"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_events" ADD CONSTRAINT "link_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_syncs" ADD CONSTRAINT "calendar_syncs_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_registration_id_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "event_sessions_event_code_uq" ON "event_sessions" USING btree ("event_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "events_slug_uq" ON "events" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "events_status_idx" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "form_options_question_idx" ON "form_options" USING btree ("question_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "form_options_question_value_uq" ON "form_options" USING btree ("question_id","value");--> statement-breakpoint
CREATE UNIQUE INDEX "form_questions_event_key_uq" ON "form_questions" USING btree ("event_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role","is_active");--> statement-breakpoint
CREATE INDEX "consents_registration_type_idx" ON "consents" USING btree ("registration_id","type");--> statement-breakpoint
CREATE INDEX "registration_answers_question_option_idx" ON "registration_answers" USING btree ("question_id","option_id");--> statement-breakpoint
CREATE INDEX "registration_answers_registration_idx" ON "registration_answers" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "registration_sessions_session_idx" ON "registration_sessions" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_event_email_uq" ON "registrations" USING btree ("event_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "registrations_code_uq" ON "registrations" USING btree ("registration_code");--> statement-breakpoint
CREATE INDEX "registrations_event_status_idx" ON "registrations" USING btree ("event_id","status");--> statement-breakpoint
CREATE INDEX "registrations_phone_idx" ON "registrations" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "registrations_created_idx" ON "registrations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "registrations_share_link_idx" ON "registrations" USING btree ("share_link_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seat_holds_token_uq" ON "seat_holds" USING btree ("hold_token");--> statement-breakpoint
CREATE INDEX "seat_holds_expires_idx" ON "seat_holds" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "seat_holds_session_idx" ON "seat_holds" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "badge_prints_ticket_idx" ON "badge_prints" USING btree ("ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "check_ins_ticket_session_uq" ON "check_ins" USING btree ("ticket_id","session_id");--> statement-breakpoint
CREATE INDEX "check_ins_session_time_idx" ON "check_ins" USING btree ("session_id","checked_in_at");--> statement-breakpoint
CREATE INDEX "check_ins_staff_idx" ON "check_ins" USING btree ("staff_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_qr_token_uq" ON "tickets" USING btree ("qr_token");--> statement-breakpoint
CREATE UNIQUE INDEX "tickets_code_uq" ON "tickets" USING btree ("ticket_code");--> statement-breakpoint
CREATE INDEX "tickets_registration_idx" ON "tickets" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "media_assets_event_type_idx" ON "media_assets" USING btree ("event_id","type","sort_order");--> statement-breakpoint
CREATE INDEX "link_events_link_time_idx" ON "link_events" USING btree ("share_link_id","created_at");--> statement-breakpoint
CREATE INDEX "link_events_action_time_idx" ON "link_events" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "link_events_visitor_idx" ON "link_events" USING btree ("visitor_hash");--> statement-breakpoint
CREATE INDEX "link_events_event_idx" ON "link_events" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "share_links_code_uq" ON "share_links" USING btree ("code");--> statement-breakpoint
CREATE INDEX "share_links_event_idx" ON "share_links" USING btree ("event_id","is_active");--> statement-breakpoint
CREATE INDEX "audit_logs_user_time_idx" ON "audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_action_time_idx" ON "audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "calendar_syncs_registration_idx" ON "calendar_syncs" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "email_logs_registration_idx" ON "email_logs" USING btree ("registration_id");--> statement-breakpoint
CREATE INDEX "email_logs_status_idx" ON "email_logs" USING btree ("status","created_at");