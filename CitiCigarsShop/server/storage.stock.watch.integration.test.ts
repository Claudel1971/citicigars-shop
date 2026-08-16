import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";

const describeWithLocalDb = process.env.MYSQL_URL ? describe : describe.skip;

describeWithLocalDb("DNA watch invariant against a non-production DB", () => {
  const normalRequestId = randomUUID();
  const zeroRequestId = randomUUID();
  const createdLeadIds: number[] = [];
  let stockStorage: any;
  let db: any;
  let dnaLeads: any;
  let dnaAvailabilityWatch: any;

  beforeAll(async () => {
    ({ stockStorage } = await import("./storage.stock"));
    ({ db } = await import("./db.mysql"));
    ({ dnaLeads, dnaAvailabilityWatch } = await import("../shared/schema.stock"));
  });

  afterAll(async () => {
    if (createdLeadIds.length) {
      await db.delete(dnaAvailabilityWatch).where(inArray(dnaAvailabilityWatch.leadId, createdLeadIds));
    }
    await db.delete(dnaLeads).where(inArray(dnaLeads.clientRequestId, [normalRequestId, zeroRequestId]));
    await db.$client.end();
  });

  async function createLead(clientRequestId: string, captureMode: "normal" | "zero") {
    const result = await stockStorage.upsertLeadIdempotent({
      clientRequestId,
      firstName: "Watch",
      lastName: captureMode,
      country: "CM",
      city: "Douala",
      whatsapp: "690000000",
      dnaProfileId: "VEL-2-2",
      answersSnapshot: {},
      refinementsSnapshot: {},
      consentGiven: true,
      captureMode,
    });
    createdLeadIds.push(result.lead.id);
    return result.lead;
  }

  const watchInput = (clientRequestId: string) => ({
    clientRequestId,
    dnaProfileId: "VEL-2-2",
    answersSnapshot: {},
    refinementsSnapshot: {},
  });

  it("refuses a normal lead and creates no watch", async () => {
    const lead = await createLead(normalRequestId, "normal");
    const result = await stockStorage.upsertWatchIdempotent(watchInput(normalRequestId));
    const watches = await db.select().from(dnaAvailabilityWatch).where(eq(dnaAvailabilityWatch.leadId, lead.id));
    const [leadAfterWatch] = await db.select({ capturedAtStep: dnaLeads.capturedAtStep }).from(dnaLeads).where(eq(dnaLeads.id, lead.id));

    expect(lead.capturedAtStep).toBe("STEP4_WITH_RESULTS");
    expect(result).toEqual({ error: "zero_case_required" });
    expect(watches).toHaveLength(0);
    expect(leadAfterWatch.capturedAtStep).toBe("STEP4_WITH_RESULTS");
  });

  it("accepts a zero lead and keeps replay idempotent", async () => {
    const lead = await createLead(zeroRequestId, "zero");
    const first = await stockStorage.upsertWatchIdempotent(watchInput(zeroRequestId));
    const replay = await stockStorage.upsertWatchIdempotent(watchInput(zeroRequestId));
    const watches = await db.select().from(dnaAvailabilityWatch).where(eq(dnaAvailabilityWatch.leadId, lead.id));
    const [leadAfterWatch] = await db.select({ capturedAtStep: dnaLeads.capturedAtStep }).from(dnaLeads).where(eq(dnaLeads.id, lead.id));

    expect(lead.capturedAtStep).toBe("STEP6_ZERO_CASE");
    expect("watch" in first && first.created).toBe(true);
    expect("watch" in replay && replay.created).toBe(false);
    expect("watch" in first && "watch" in replay && replay.watch.id).toBe(first.watch.id);
    expect(watches).toHaveLength(1);
    expect(leadAfterWatch.capturedAtStep).toBe("STEP6_ZERO_CASE");
  });
});
