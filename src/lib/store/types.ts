import type { BlockEntry, Lead, OutreachItem, RemovalRequest, Workspace } from "../types";

/**
 * Everything the app reads or writes goes through this interface.
 * The JSON file implementation is for local development; a Postgres or
 * Supabase implementation only has to implement these methods.
 *
 * All methods are scoped to one workspace for now. When accounts are added,
 * the workspace id comes from the signed-in user.
 */
export interface Repository {
  getWorkspace(): Promise<Workspace>;
  saveWorkspace(workspace: Workspace): Promise<void>;

  listLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  addLeads(leads: Lead[]): Promise<void>;
  updateLead(id: string, patch: Partial<Omit<Lead, "id" | "workspaceId">>): Promise<Lead | undefined>;
  /** Delete leads (and their outreach) by profile URL. Returns the number of leads deleted. */
  deleteLeadsByProfileUrl(profileUrl: string): Promise<number>;

  listOutreach(): Promise<OutreachItem[]>;
  getOutreach(id: string): Promise<OutreachItem | undefined>;
  addOutreach(item: OutreachItem): Promise<void>;
  /** Insert or replace items by id. */
  saveOutreach(items: OutreachItem[]): Promise<void>;

  listBlockList(): Promise<BlockEntry[]>;
  addBlockEntry(entry: BlockEntry): Promise<void>;
  removeBlockEntry(id: string): Promise<void>;

  listRemovalRequests(): Promise<RemovalRequest[]>;
  addRemovalRequest(request: RemovalRequest): Promise<void>;
}

/** Shape of the persisted data, shared by file-based implementations. */
export interface StoreData {
  version: 1;
  workspace: Workspace;
  leads: Lead[];
  outreach: OutreachItem[];
  blockList: BlockEntry[];
  removalRequests: RemovalRequest[];
}
