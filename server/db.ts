import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  deploymentAllocations,
  InsertUser,
  officers,
  routeAdvisories,
  signalActions,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && ENV.databaseUrl) {
    try {
      _db = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  values.lastSignedIn ??= new Date();
  updateSet.lastSignedIn ??= new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listOfficers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(officers).orderBy(desc(officers.updatedAt));
}

export async function setOfficerStatus(id: number, status: typeof officers.$inferInsert.status) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(officers).set({ status, lastSeenAt: new Date() }).where(eq(officers.id, id));
  const rows = await db.select().from(officers).where(eq(officers.id, id)).limit(1);
  return rows[0];
}

export async function listAllocations(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deploymentAllocations).orderBy(desc(deploymentAllocations.createdAt)).limit(limit);
}

export async function createAllocation(input: typeof deploymentAllocations.$inferInsert) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(deploymentAllocations).values(input);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(deploymentAllocations).where(eq(deploymentAllocations.id, id)).limit(1);
  return rows[0];
}

export async function updateAllocationStatus(id: number, status: typeof deploymentAllocations.$inferInsert.status) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(deploymentAllocations).set({ status }).where(eq(deploymentAllocations.id, id));
  const rows = await db.select().from(deploymentAllocations).where(eq(deploymentAllocations.id, id)).limit(1);
  return rows[0];
}

export async function createRouteAdvisory(input: typeof routeAdvisories.$inferInsert) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(routeAdvisories).values(input);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(routeAdvisories).where(eq(routeAdvisories.id, id)).limit(1);
  return rows[0];
}

export async function createSignalAction(input: typeof signalActions.$inferInsert) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.insert(signalActions).values(input);
  const id = Number(result[0].insertId);
  const rows = await db.select().from(signalActions).where(eq(signalActions.id, id)).limit(1);
  return rows[0];
}
