CREATE TYPE "public"."billing_period" AS ENUM('once', 'monthly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."outbox_status" AS ENUM('pending', 'processing', 'succeeded', 'dead');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'ordered');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('seller', 'admin');--> statement-breakpoint
CREATE TABLE "acceptances" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"version" integer NOT NULL,
	"signer_name" text NOT NULL,
	"signer_email" text NOT NULL,
	"ip" text,
	"user_agent" text,
	"pdf_sha256" text NOT NULL,
	"accepted_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_sku" text NOT NULL,
	"mfr_part_number" text,
	"normalized_mpn" text,
	"manufacturer" text,
	"description" text NOT NULL,
	"cost_cents" integer,
	"msrp_cents" integer,
	"stock" integer,
	"fetched_at" timestamp with time zone NOT NULL,
	"halo_item_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"halo_client_id" integer NOT NULL,
	"name" text NOT NULL,
	"tax_code" text,
	"synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"halo_user_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"halo_ticket_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"title" text NOT NULL,
	"status" text NOT NULL,
	"synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"target" text NOT NULL,
	"operation" text NOT NULL,
	"payload" jsonb NOT NULL,
	"idempotency_key" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"status" "outbox_status" DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"benji_transaction_id" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"status" text NOT NULL,
	"applied" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"markup_bps" integer NOT NULL,
	"min_margin_bps" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"section_id" text NOT NULL,
	"catalog_item_id" text,
	"description" text NOT NULL,
	"qty_milli" integer NOT NULL,
	"unit_cost_cents" integer,
	"unit_price_cents" integer NOT NULL,
	"billing" "billing_period" NOT NULL,
	"optional" boolean DEFAULT false NOT NULL,
	"selected" boolean DEFAULT true NOT NULL,
	"taxable" boolean DEFAULT true NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"quote_id" text NOT NULL,
	"title" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"client_id" text NOT NULL,
	"contact_id" text,
	"opportunity_id" text,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"valid_until" timestamp with time zone,
	"deposit_bps" integer DEFAULT 0 NOT NULL,
	"tax_bps" integer DEFAULT 0 NOT NULL,
	"public_token" text NOT NULL,
	"halo_quotation_id" integer,
	"created_by_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" text PRIMARY KEY NOT NULL,
	"halo_site_id" integer NOT NULL,
	"client_id" text NOT NULL,
	"address" jsonb,
	"synced_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"entra_oid" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" NOT NULL,
	"halo_agent_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "acceptances" ADD CONSTRAINT "acceptances_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_section_id_quote_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."quote_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_sections" ADD CONSTRAINT "quote_sections_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acceptances_quote_version_idx" ON "acceptances" USING btree ("quote_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_items_source_sku_idx" ON "catalog_items" USING btree ("source","source_sku");--> statement-breakpoint
CREATE INDEX "catalog_items_normalized_mpn_idx" ON "catalog_items" USING btree ("normalized_mpn");--> statement-breakpoint
CREATE UNIQUE INDEX "clients_halo_client_id_idx" ON "clients" USING btree ("halo_client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_halo_user_id_idx" ON "contacts" USING btree ("halo_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_halo_ticket_id_idx" ON "opportunities" USING btree ("halo_ticket_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outbox_idempotency_key_idx" ON "outbox" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "outbox_status_available_idx" ON "outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_benji_transaction_id_idx" ON "payments" USING btree ("benji_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pricing_rules_scope_idx" ON "pricing_rules" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "quote_lines_section_id_idx" ON "quote_lines" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "quote_sections_quote_id_idx" ON "quote_sections" USING btree ("quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_number_version_idx" ON "quotes" USING btree ("number","version");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_public_token_idx" ON "quotes" USING btree ("public_token");--> statement-breakpoint
CREATE INDEX "quotes_client_id_idx" ON "quotes" USING btree ("client_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_halo_site_id_idx" ON "sites" USING btree ("halo_site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "templates_kind_name_idx" ON "templates" USING btree ("kind","name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_entra_oid_idx" ON "users" USING btree ("entra_oid");