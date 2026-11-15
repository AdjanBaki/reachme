import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonFileRepository } from "./json-store";

describe("JsonFileRepository", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "reachme-store-"));
    file = path.join(dir, "store.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("seeds from sample data on first read and persists to disk", async () => {
    const repo = new JsonFileRepository(file);
    const leads = await repo.listLeads();
    expect(leads.length).toBeGreaterThan(10);
    const onDisk = JSON.parse(await readFile(file, "utf8"));
    expect(onDisk.leads).toHaveLength(leads.length);
  });

  it("keeps Swedish characters intact", async () => {
    const repo = new JsonFileRepository(file);
    const lead = await repo.getLead("lead_1");
    expect(lead?.location).toBe("Göteborg");
    const again = await new JsonFileRepository(file).getLead("lead_1");
    expect(again?.location).toBe("Göteborg");
  });

  it("serializes concurrent writes without losing any", async () => {
    const repo = new JsonFileRepository(file);
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        repo.addBlockEntry({ id: `b${i}`, workspaceId: "ws_demo", kind: "company", value: `Firma ${i}`, createdAt: "" }),
      ),
    );
    expect(await new JsonFileRepository(file).listBlockList()).toHaveLength(20);
  });

  it("deletes a person's leads and outreach by profile URL", async () => {
    const repo = new JsonFileRepository(file);
    const deleted = await repo.deleteLeadsByProfileUrl("linkedin.com/in/example-anna/");
    expect(deleted).toBe(1);
    expect(await repo.getLead("lead_1")).toBeUndefined();
    expect((await repo.listOutreach()).some((o) => o.leadId === "lead_1")).toBe(false);
  });
});
