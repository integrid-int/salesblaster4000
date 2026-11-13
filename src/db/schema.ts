import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["seller", "admin"]);
export const quoteStatus = pgEnum("quote_status", [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "declined",
  "expired",
  "ordered",
]);
export const billingPeriod = pgEnum("billing_period", ["once", "monthly", "annual"]);
export const outboxStatus = pgEnum("outbox_status", [
  "pending",
  "processing",
  "succeeded",
  "dead",
]);

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: id(),
    entraOid: text("entra_oid").notNull(),
    email: text("email").notNull(),
    name: text("name"),
    role: userRole("role").notNull(),
    haloAgentId: integer("halo_agent_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("users_entra_oid_idx").on(table.entraOid)],
);

export const clients = pgTable(
  "clients",
  {
    id: id(),
    haloClientId: integer("halo_client_id").notNull(),
    name: text("name").notNull(),
    taxCode: text("tax_code"),
    syncedAt: timestamp("synced_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("clients_halo_client_id_idx").on(table.haloClientId)],
);

export const sites = pgTable(
  "sites",
  {
    id: id(),
    haloSiteId: integer("halo_site_id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    address: jsonb("address").$type<Record<string, unknown>>(),
    syncedAt: timestamp("synced_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("sites_halo_site_id_idx").on(table.haloSiteId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    haloUserId: integer("halo_user_id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    name: text("name").notNull(),
    email: text("email"),
    syncedAt: timestamp("synced_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("contacts_halo_user_id_idx").on(table.haloUserId)],
);

export const opportunities = pgTable(
  "opportunities",
  {
    id: id(),
    haloTicketId: integer("halo_ticket_id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    title: text("title").notNull(),
    status: text("status").notNull(),
    syncedAt: timestamp("synced_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("opportunities_halo_ticket_id_idx").on(table.haloTicketId)],
);

export const catalogItems = pgTable(
  "catalog_items",
  {
    id: id(),
    source: text("source").notNull(),
    sourceSku: text("source_sku").notNull(),
    mfrPartNumber: text("mfr_part_number"),
    normalizedMpn: text("normalized_mpn"),
    manufacturer: text("manufacturer"),
    description: text("description").notNull(),
    costCents: integer("cost_cents"),
    msrpCents: integer("msrp_cents"),
    stock: integer("stock"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true, mode: "date" }).notNull(),
    haloItemId: integer("halo_item_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("catalog_items_source_sku_idx").on(table.source, table.sourceSku),
    index("catalog_items_normalized_mpn_idx").on(table.normalizedMpn),
  ],
);

export const quotes = pgTable(
  "quotes",
  {
    id: id(),
    number: text("number").notNull(),
    version: integer("version").notNull().default(1),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    contactId: text("contact_id").references(() => contacts.id),
    opportunityId: text("opportunity_id").references(() => opportunities.id),
    status: quoteStatus("status").notNull().default("draft"),
    validUntil: timestamp("valid_until", { withTimezone: true, mode: "date" }),
    depositBps: integer("deposit_bps").notNull().default(0),
    taxBps: integer("tax_bps").notNull().default(0),
    publicToken: text("public_token").notNull(),
    haloQuotationId: integer("halo_quotation_id"),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("quotes_number_version_idx").on(table.number, table.version),
    uniqueIndex("quotes_public_token_idx").on(table.publicToken),
    index("quotes_client_id_idx").on(table.clientId),
  ],
);

export const quoteSections = pgTable(
  "quote_sections",
  {
    id: id(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("quote_sections_quote_id_idx").on(table.quoteId)],
);

export const quoteLines = pgTable(
  "quote_lines",
  {
    id: id(),
    sectionId: text("section_id")
      .notNull()
      .references(() => quoteSections.id, { onDelete: "cascade" }),
    catalogItemId: text("catalog_item_id").references(() => catalogItems.id),
    description: text("description").notNull(),
    qtyMilli: integer("qty_milli").notNull(),
    unitCostCents: integer("unit_cost_cents"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    billing: billingPeriod("billing").notNull(),
    optional: boolean("optional").notNull().default(false),
    selected: boolean("selected").notNull().default(true),
    taxable: boolean("taxable").notNull().default(true),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("quote_lines_section_id_idx").on(table.sectionId)],
);

export const templates = pgTable(
  "templates",
  {
    id: id(),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("templates_kind_name_idx").on(table.kind, table.name)],
);

export const pricingRules = pgTable(
  "pricing_rules",
  {
    id: id(),
    scope: text("scope").notNull(),
    markupBps: integer("markup_bps").notNull(),
    minMarginBps: integer("min_margin_bps").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("pricing_rules_scope_idx").on(table.scope)],
);

export const acceptances = pgTable(
  "acceptances",
  {
    id: id(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id),
    version: integer("version").notNull(),
    signerName: text("signer_name").notNull(),
    signerEmail: text("signer_email").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    pdfSha256: text("pdf_sha256").notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [uniqueIndex("acceptances_quote_version_idx").on(table.quoteId, table.version)],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => quotes.id),
    benjiTransactionId: text("benji_transaction_id").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull(),
    applied: boolean("applied").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("payments_benji_transaction_id_idx").on(table.benjiTransactionId)],
);

export const outbox = pgTable(
  "outbox",
  {
    id: id(),
    target: text("target").notNull(),
    operation: text("operation").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    status: outboxStatus("status").notNull().default("pending"),
    availableAt: timestamp("available_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("outbox_idempotency_key_idx").on(table.idempotencyKey),
    index("outbox_status_available_idx").on(table.status, table.availableAt),
  ],
);

export const clientsRelations = relations(clients, ({ many }) => ({
  sites: many(sites),
  contacts: many(contacts),
  opportunities: many(opportunities),
  quotes: many(quotes),
}));

export const sitesRelations = relations(sites, ({ one }) => ({
  client: one(clients, { fields: [sites.clientId], references: [clients.id] }),
}));

export const contactsRelations = relations(contacts, ({ one }) => ({
  client: one(clients, { fields: [contacts.clientId], references: [clients.id] }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one }) => ({
  client: one(clients, { fields: [opportunities.clientId], references: [clients.id] }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  client: one(clients, { fields: [quotes.clientId], references: [clients.id] }),
  contact: one(contacts, { fields: [quotes.contactId], references: [contacts.id] }),
  opportunity: one(opportunities, {
    fields: [quotes.opportunityId],
    references: [opportunities.id],
  }),
  createdBy: one(users, { fields: [quotes.createdById], references: [users.id] }),
  sections: many(quoteSections),
  acceptances: many(acceptances),
  payments: many(payments),
}));

export const quoteSectionsRelations = relations(quoteSections, ({ one, many }) => ({
  quote: one(quotes, { fields: [quoteSections.quoteId], references: [quotes.id] }),
  lines: many(quoteLines),
}));

export const quoteLinesRelations = relations(quoteLines, ({ one }) => ({
  section: one(quoteSections, {
    fields: [quoteLines.sectionId],
    references: [quoteSections.id],
  }),
  catalogItem: one(catalogItems, {
    fields: [quoteLines.catalogItemId],
    references: [catalogItems.id],
  }),
}));

export const acceptancesRelations = relations(acceptances, ({ one }) => ({
  quote: one(quotes, { fields: [acceptances.quoteId], references: [quotes.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  quote: one(quotes, { fields: [payments.quoteId], references: [quotes.id] }),
}));
