import crypto from "crypto";
import { eq, and, desc, asc, sql as sqlOp } from "drizzle-orm";
import { db } from "../db.mysql";
import {
  customers,
  customerInteractions,
  customerDna,
  crmFollowups,
  type InsertCustomer,
  type InsertCustomerInteraction,
  type InsertCustomerDna,
  type InsertCrmFollowup,
} from "../../shared/schema.crm";
import { orders, orderItems } from "../../shared/schema.sales";
import { normalizePhone, findExactPhoneMatch } from "./phone";
import { formatCtcgId, nextSequenceFromExisting } from "./ctcg-id";

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Allocates the next CTCG-CUST-XXXXXX id by looking at the real max
 * currently in the table (never reused, never renumbered — see
 * ID_CONVENTIONS.md). CTCG-CUST-000000 is reserved for CitiCigars itself
 * and is expected to already exist before this is ever called for a new
 * external customer.
 */
async function allocateCustomerId(): Promise<string> {
  const rows = await db.select({ customerId: customers.customerId }).from(customers);
  const nextSeq = nextSequenceFromExisting(rows.map((r) => r.customerId));
  return formatCtcgId("CUST", nextSeq);
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export interface CreateCustomerResult {
  customer: typeof customers.$inferSelect;
  wasExistingDuplicate: boolean;
}

/**
 * Creates a customer, but first checks for an EXACT phone match. If found,
 * returns the existing customer instead of creating a duplicate (this is
 * the only automatic reconciliation allowed — see brief: "zéro fusion
 * automatique douteuse" for anything less certain than an exact phone
 * match).
 */
export async function createCustomer(input: InsertCustomer): Promise<CreateCustomerResult> {
  const normalizedPhone = normalizePhone(input.phoneWhatsapp ?? null);

  if (normalizedPhone) {
    const existingCandidates = await db
      .select({
        customerId: customers.customerId,
        phoneWhatsapp: customers.phoneWhatsapp,
      })
      .from(customers)
      .where(eq(customers.phoneWhatsapp, normalizedPhone));

    const match = findExactPhoneMatch(normalizedPhone, existingCandidates);
    if (match) {
      const [existing] = await db.select().from(customers).where(eq(customers.customerId, match.customerId));
      return { customer: existing, wasExistingDuplicate: true };
    }
  }

  const customerId = await allocateCustomerId();
  await db.insert(customers).values({
    ...input,
    customerId,
    phoneWhatsapp: normalizedPhone,
    phoneRaw: input.phoneWhatsapp ?? input.phoneRaw ?? null,
  } as typeof customers.$inferInsert);

  const [created] = await db.select().from(customers).where(eq(customers.customerId, customerId));
  return { customer: created, wasExistingDuplicate: false };
}

export async function updateCustomer(
  customerId: string,
  updates: Partial<InsertCustomer>
): Promise<typeof customers.$inferSelect | undefined> {
  const patch: Partial<typeof customers.$inferInsert> = { ...updates };
  if (typeof updates.phoneWhatsapp === "string") {
    patch.phoneWhatsapp = normalizePhone(updates.phoneWhatsapp);
    patch.phoneRaw = updates.phoneWhatsapp;
  }
  await db.update(customers).set(patch).where(eq(customers.customerId, customerId));
  const [updated] = await db.select().from(customers).where(eq(customers.customerId, customerId));
  return updated;
}

export interface CustomerListFilters {
  status?: string;
  search?: string;
  hasNextAction?: boolean;
}

export async function listCustomers(filters: CustomerListFilters = {}) {
  // Default order is the stable business identifier. The UI can then apply
  // interactive sorting without the list jumping around because updatedAt
  // changed after a note/edit.
  const [rows, balanceRows] = await Promise.all([
    db.select().from(customers).orderBy(asc(customers.customerId)),
    db
      .select({
        customerId: orders.customerId,
        balanceDueXaf: sqlOp<number>`COALESCE(SUM(${orders.balanceDue}), 0)`,
      })
      .from(orders)
      .groupBy(orders.customerId),
  ]);

  const balanceByCustomer = new Map(
    balanceRows.map((r) => [r.customerId, Number(r.balanceDueXaf ?? 0)])
  );

  return rows
    .filter((c) => {
      if (filters.status && c.status !== filters.status) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const haystack = `${c.customerId ?? ""} ${c.firstName ?? ""} ${c.lastName ?? ""} ${c.phoneWhatsapp ?? ""} ${
          c.companyName ?? ""
        }`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .map((c) => ({
      ...c,
      balanceDueXaf: balanceByCustomer.get(c.customerId) ?? 0,
    }));
}

/**
 * Full customer detail view: identity + DNA + orders summary + a few
 * recent interactions. This backs the "fiche client" screen (brief 8.B).
 */
export async function getCustomerDetail(customerId: string) {
  const [customer] = await db.select().from(customers).where(eq(customers.customerId, customerId));
  if (!customer) return undefined;

  const [interactions, dnaResults, customerOrders] = await Promise.all([
    db
      .select()
      .from(customerInteractions)
      .where(eq(customerInteractions.customerId, customerId))
      .orderBy(desc(customerInteractions.interactionDate)),
    db.select().from(customerDna).where(eq(customerDna.customerId, customerId)).orderBy(desc(customerDna.testedAt)),
    db.select().from(orders).where(eq(orders.customerId, customerId)).orderBy(desc(orders.orderDate)),
  ]);

  const orderCount = customerOrders.length;
  const totalRevenueXaf = customerOrders.reduce((s, o) => s + o.finalSaleTotalXaf, 0);
  const averageBasketXaf = orderCount > 0 ? Math.round(totalRevenueXaf / orderCount) : 0;
  const lastOrder = customerOrders[0] ?? null;

  return {
    customer,
    interactions,
    dna: dnaResults[0] ?? null,
    dnaHistory: dnaResults,
    orders: customerOrders,
    summary: {
      orderCount,
      totalRevenueXaf,
      averageBasketXaf,
      lastOrderDate: lastOrder?.orderDate ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Interactions (append-only — never overwrite history)
// ---------------------------------------------------------------------------

export async function addInteraction(input: InsertCustomerInteraction) {
  const interactionId = generateId();
  await db.insert(customerInteractions).values({
    ...input,
    interactionId,
  } as typeof customerInteractions.$inferInsert);
  const [created] = await db
    .select()
    .from(customerInteractions)
    .where(eq(customerInteractions.interactionId, interactionId));
  return created;
}

// ---------------------------------------------------------------------------
// DNA — this table only stores results produced by the existing, external
// DNA/Curator engine. Nothing here recomputes or redefines any DNA profile.
// ---------------------------------------------------------------------------

export async function recordDnaResult(input: InsertCustomerDna) {
  const dnaId = generateId();
  await db.insert(customerDna).values({ ...input, dnaId } as typeof customerDna.$inferInsert);
  const [created] = await db.select().from(customerDna).where(eq(customerDna.dnaId, dnaId));
  return created;
}

// ---------------------------------------------------------------------------
// Followups — first-class objects distinct from raw interaction text, so
// state (OPEN/DONE/CANCELLED) is tracked explicitly rather than inferred
// from the latest interaction's next_action_at.
// ---------------------------------------------------------------------------

export async function createFollowup(input: InsertCrmFollowup) {
  const existing = await db.select({ followupId: crmFollowups.followupId }).from(crmFollowups);
  const followupId = formatCtcgId("FUP", nextSequenceFromExisting(existing.map((r) => r.followupId)));
  await db.insert(crmFollowups).values({ ...input, followupId } as typeof crmFollowups.$inferInsert);
  const [created] = await db.select().from(crmFollowups).where(eq(crmFollowups.followupId, followupId));
  return created;
}

export async function completeFollowup(followupId: string) {
  await db
    .update(crmFollowups)
    .set({ status: "DONE", completedAt: new Date() })
    .where(eq(crmFollowups.followupId, followupId));
}

export async function cancelFollowup(followupId: string) {
  await db.update(crmFollowups).set({ status: "CANCELLED" }).where(eq(crmFollowups.followupId, followupId));
}

/**
 * Prioritized followup list backing the "relances" screen (brief 8.D):
 * open followups only, soonest due date first.
 */
export async function listOpenFollowups() {
  return db
    .select()
    .from(crmFollowups)
    .where(eq(crmFollowups.status, "OPEN"))
    .orderBy(asc(crmFollowups.dueAt));
}
