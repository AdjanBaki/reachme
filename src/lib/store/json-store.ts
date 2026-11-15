import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeProfileUrl } from "../domain/normalize";
import { sampleLeads, sampleOutreach, sampleWorkspace } from "../sample-data";
import type { Repository, StoreData } from "./types";

export function seedData(): StoreData {
  return {
    version: 1,
    workspace: structuredClone(sampleWorkspace),
    leads: structuredClone(sampleLeads),
    outreach: structuredClone(sampleOutreach),
    blockList: [],
    removalRequests: [],
  };
}

/**
 * Stores everything in one JSON file. Writes are serialized through a promise
 * chain and written atomically (temp file + rename). Good enough for a single
 * local process; replace with a database before running more than one server.
 */
export class JsonFileRepository implements Repository {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private async load(): Promise<StoreData> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as StoreData;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const data = seedData();
      await this.persist(data);
      return data;
    }
  }

  private async persist(data: StoreData): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const tmp = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await rename(tmp, this.filePath);
  }

  /** Run a read after any pending writes. */
  private read<T>(fn: (data: StoreData) => T): Promise<T> {
    const next = this.queue.then(async () => fn(await this.load()));
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Run a read-modify-write exclusively. */
  private mutate<T>(fn: (data: StoreData) => T): Promise<T> {
    const next = this.queue.then(async () => {
      const data = await this.load();
      const result = fn(data);
      await this.persist(data);
      return result;
    });
    this.queue = next.catch(() => undefined);
    return next;
  }

  getWorkspace() {
    return this.read((d) => d.workspace);
  }

  saveWorkspace(workspace: StoreData["workspace"]) {
    return this.mutate((d) => {
      d.workspace = workspace;
    });
  }

  listLeads() {
    return this.read((d) => d.leads);
  }

  getLead(id: string) {
    return this.read((d) => d.leads.find((l) => l.id === id));
  }

  addLeads(leads: StoreData["leads"]) {
    return this.mutate((d) => {
      d.leads.push(...leads);
    });
  }

  updateLead(id: string, patch: Parameters<Repository["updateLead"]>[1]) {
    return this.mutate((d) => {
      const lead = d.leads.find((l) => l.id === id);
      if (!lead) return undefined;
      Object.assign(lead, patch);
      return lead;
    });
  }

  deleteLeadsByProfileUrl(profileUrl: string) {
    const key = normalizeProfileUrl(profileUrl);
    return this.mutate((d) => {
      const removed = d.leads.filter((l) => normalizeProfileUrl(l.profileUrl) === key);
      const removedIds = new Set(removed.map((l) => l.id));
      d.leads = d.leads.filter((l) => !removedIds.has(l.id));
      d.outreach = d.outreach.filter((o) => !removedIds.has(o.leadId));
      return removed.length;
    });
  }

  listOutreach() {
    return this.read((d) => d.outreach);
  }

  getOutreach(id: string) {
    return this.read((d) => d.outreach.find((o) => o.id === id));
  }

  addOutreach(item: StoreData["outreach"][number]) {
    return this.mutate((d) => {
      d.outreach.push(item);
    });
  }

  saveOutreach(items: StoreData["outreach"]) {
    return this.mutate((d) => {
      for (const item of items) {
        const index = d.outreach.findIndex((o) => o.id === item.id);
        if (index === -1) d.outreach.push(item);
        else d.outreach[index] = item;
      }
    });
  }

  listBlockList() {
    return this.read((d) => d.blockList);
  }

  addBlockEntry(entry: StoreData["blockList"][number]) {
    return this.mutate((d) => {
      d.blockList.push(entry);
    });
  }

  removeBlockEntry(id: string) {
    return this.mutate((d) => {
      d.blockList = d.blockList.filter((b) => b.id !== id);
    });
  }

  listRemovalRequests() {
    return this.read((d) => d.removalRequests);
  }

  addRemovalRequest(request: StoreData["removalRequests"][number]) {
    return this.mutate((d) => {
      d.removalRequests.push(request);
    });
  }
}
