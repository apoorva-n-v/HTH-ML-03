import { double, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const officers = mysqlTable("officers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  name: varchar("name", { length: 160 }).notNull(),
  badgeNumber: varchar("badgeNumber", { length: 64 }).notNull().unique(),
  callSign: varchar("callSign", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["available", "assigned", "enroute", "deployed", "offDuty"]).default("available").notNull(),
  currentLat: double("currentLat"),
  currentLng: double("currentLng"),
  lastSeenAt: timestamp("lastSeenAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const deploymentAllocations = mysqlTable("deploymentAllocations", {
  id: int("id").autoincrement().primaryKey(),
  officerId: int("officerId").notNull(),
  selectedArea: varchar("selectedArea", { length: 180 }).notNull(),
  road: varchar("road", { length: 180 }).notNull(),
  latitude: double("latitude").notNull(),
  longitude: double("longitude").notNull(),
  horizonMinutes: int("horizonMinutes").notNull(),
  predictedOccupancy: int("predictedOccupancy").notNull(),
  arrivalAt: timestamp("arrivalAt").notNull(),
  status: mysqlEnum("status", ["proposed", "scheduled", "enroute", "deployed", "complete", "cancelled"]).default("proposed").notNull(),
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const integrationEvents = mysqlTable("integrationEvents", {
  id: int("id").autoincrement().primaryKey(),
  selectedArea: varchar("selectedArea", { length: 180 }).notNull(),
  source: varchar("source", { length: 64 }).notNull(),
  externalId: varchar("externalId", { length: 180 }),
  title: varchar("title", { length: 240 }).notNull(),
  startsAt: timestamp("startsAt"),
  endsAt: timestamp("endsAt"),
  impactLevel: mysqlEnum("impactLevel", ["low", "medium", "high"]).default("low").notNull(),
  latitude: double("latitude").notNull(),
  longitude: double("longitude").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const routeAdvisories = mysqlTable("routeAdvisories", {
  id: int("id").autoincrement().primaryKey(),
  allocationId: int("allocationId"),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  encodedPolyline: text("encodedPolyline"),
  distanceMeters: int("distanceMeters"),
  durationSeconds: int("durationSeconds"),
  status: mysqlEnum("status", ["active", "stale", "failed"]).default("active").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const signalActions = mysqlTable("signalActions", {
  id: int("id").autoincrement().primaryKey(),
  selectedArea: varchar("selectedArea", { length: 180 }).notNull(),
  controllerId: varchar("controllerId", { length: 120 }).notNull(),
  action: varchar("action", { length: 180 }).notNull(),
  status: mysqlEnum("status", ["queued", "sent", "acknowledged", "failed", "notConfigured"]).default("queued").notNull(),
  requestedBy: int("requestedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Officer = typeof officers.$inferSelect;
export type DeploymentAllocation = typeof deploymentAllocations.$inferSelect;
export type IntegrationEvent = typeof integrationEvents.$inferSelect;
export type RouteAdvisory = typeof routeAdvisories.$inferSelect;
export type SignalAction = typeof signalActions.$inferSelect;
