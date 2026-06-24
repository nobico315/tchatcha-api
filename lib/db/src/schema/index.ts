import { pgTable, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull().unique(),
  pin: text("pin").notNull(), // hashed PIN
  role: text("role").notNull(), // 'agent' | 'gerant'
  managerId: text("manager_id"),
  subscriptionExpiry: timestamp("subscription_expiry").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessionsTable = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const daySessionsTable = pgTable("day_sessions", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // YYYY-MM-DD
  openingCash: integer("opening_cash").notNull().default(0),
  openingMtn: integer("opening_mtn").notNull().default(0),
  openingMoov: integer("opening_moov").notNull().default(0),
  openingCeltis: integer("opening_celtis").notNull().default(0),
  openingTotal: integer("opening_total").notNull().default(0),
  closingCash: integer("closing_cash"),
  closingMtn: integer("closing_mtn"),
  closingMoov: integer("closing_moov"),
  closingCeltis: integer("closing_celtis"),
  closingTotal: integer("closing_total"),
  isOpen: boolean("is_open").notNull().default(true),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

export const transactionsTable = pgTable("transactions", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // 'depot' | 'retrait' | 'vente'
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone").notNull(),
  amount: integer("amount").notNull(),
  operator: text("operator").notNull(), // 'MTN' | 'Moov' | 'Celtis'
  note: text("note"),
  savedClient: boolean("saved_client").notNull().default(false),
  saleMode: text("sale_mode"), // 'credit' | 'forfait'
  agentId: text("agent_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull(),
});

export const savedClientsTable = pgTable("saved_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactionLogsTable = pgTable("transaction_logs", {
  id: text("id").primaryKey(),
  transactionId: text("transaction_id").notNull(),
  action: text("action").notNull(), // 'deleted' | 'edited'
  agentId: text("agent_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  changes: jsonb("changes"),
});