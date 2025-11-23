-- Add missing columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "favorite_route_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "default_route_id" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_expires_at" timestamp;--> statement-breakpoint

-- Add foreign key constraints (no IF NOT EXISTS support in PostgreSQL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_favorite_route_id_routes_id_fk'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_favorite_route_id_routes_id_fk" FOREIGN KEY ("favorite_route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_default_route_id_routes_id_fk'
  ) THEN
    ALTER TABLE "users" ADD CONSTRAINT "users_default_route_id_routes_id_fk" FOREIGN KEY ("default_route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint

-- Add missing columns to route_stops table
ALTER TABLE "route_stops" ADD COLUMN IF NOT EXISTS "approaching_radius_ft" integer NOT NULL DEFAULT 12000;--> statement-breakpoint
ALTER TABLE "route_stops" ADD COLUMN IF NOT EXISTS "arrival_radius_ft" integer NOT NULL DEFAULT 250;--> statement-breakpoint
ALTER TABLE "route_stops" ADD COLUMN IF NOT EXISTS "scheduled_arrival_minutes" integer;--> statement-breakpoint
