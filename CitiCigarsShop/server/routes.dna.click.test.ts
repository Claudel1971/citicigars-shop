import express from "express";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  selectRows: [] as any[],
  insertedValues: null as any,
  insertCount: 0,
  insertId: 321,
}));

vi.mock("./db.mysql", () => {
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => state.selectRows),
          })),
        })),
      })),
    })),

    insert: vi.fn(() => ({
      values: vi.fn(async (values: any) => {
        state.insertedValues = values;
        state.insertCount += 1;
        return [{ insertId: state.insertId }];
      }),
    })),

    transaction: vi.fn(),
    update: vi.fn(),
  };

  return { db };
});

vi.mock("./storage.stock", () => ({
  stockStorage: {},
}));

vi.mock("./services/dna-intake", () => ({
  ingestDnaResult: vi.fn(),
}));

vi.mock("./services/dna-crm-mapping", () => ({
  mapCuratorPayloadToCrmIntake: vi.fn(),
}));

vi.mock("./services/dna-recommendations-v2", () => ({
  getLiveDnaRankingV2: vi.fn(),
}));

import { registerDnaRoutes } from "./routes.dna";

let server: Server | null = null;
let baseUrl = "";

async function startApp() {
  const app = express();
  app.use(express.json());
  registerDnaRoutes(app);

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("TEST_SERVER_ADDRESS_UNAVAILABLE");
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function postClick(body: unknown) {
  const response = await fetch(`${baseUrl}/api/dna/recommendation-click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

const validPayload = {
  clientRequestId: "REQ-001",
  customerId: "CUS-001",
  dnaId: "DNA-001",
  sku: "CTGNI0024",
};

beforeEach(async () => {
  state.selectRows = [];
  state.insertedValues = null;
  state.insertCount = 0;
  state.insertId = 321;

  await startApp();
});

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => error ? reject(error) : resolve());
    });
  }

  server = null;
});

describe("POST /api/dna/recommendation-click", () => {
  it("returns 400 when CLICK identifiers are incomplete", async () => {
    const result = await postClick({
      clientRequestId: "REQ-001",
      customerId: "CUS-001",
    });

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      error: "invalid_request",
    });

    expect(state.insertedValues).toBeNull();
  });

  it("rejects blank CLICK identifiers", async () => {
    const result = await postClick({
      ...validPayload,
      sku: "   ",
    });

    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      error: "invalid_request",
    });

    expect(state.insertCount).toBe(0);
  });

  it("returns 404 when the recommendation was not exposed in this DNA Run", async () => {
    state.selectRows = [];

    const result = await postClick(validPayload);

    expect(result.status).toBe(404);
    expect(result.body).toEqual({
      error: "recommendation_not_found",
    });

    expect(state.insertedValues).toBeNull();
  });

  it("returns 409 when the DNA Run has not completed Page 6", async () => {
    state.selectRows = [{
      recommendationId: 88,
      customerId: validPayload.customerId,
      dnaId: validPayload.dnaId,
      sku: validPayload.sku,
      page6CompletedAt: null,
    }];

    const result = await postClick(validPayload);

    expect(result.status).toBe(409);
    expect(result.body).toEqual({
      error: "dna_run_not_completed",
    });

    expect(state.insertedValues).toBeNull();
  });

  it("records CLICK attribution before returning success", async () => {
    state.selectRows = [{
      recommendationId: 88,
      customerId: validPayload.customerId,
      dnaId: validPayload.dnaId,
      sku: validPayload.sku,
      page6CompletedAt: new Date("2026-08-23T20:00:00Z"),
    }];

    const result = await postClick(validPayload);

    expect(result.status).toBe(201);

    expect(result.body).toMatchObject({
      ok: true,
      eventType: "CLICK",
      eventId: 321,
      recommendationId: 88,
      sku: validPayload.sku,
    });

    expect(state.insertedValues).toMatchObject({
      recommendationId: 88,
      customerId: validPayload.customerId,
      dnaId: validPayload.dnaId,
      eventType: "CLICK",
      sku: validPayload.sku,
    });

    expect(state.insertedValues.occurredAt).toBeInstanceOf(Date);
  });

  it("records repeated valid clicks as separate raw CLICK events", async () => {
    state.selectRows = [{
      recommendationId: 88,
      customerId: validPayload.customerId,
      dnaId: validPayload.dnaId,
      sku: validPayload.sku,
      page6CompletedAt: new Date("2026-08-23T20:00:00Z"),
    }];

    const first = await postClick(validPayload);
    const second = await postClick(validPayload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(state.insertCount).toBe(2);
  });
});
