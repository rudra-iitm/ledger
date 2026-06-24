import type { Group, GroupExpense, GroupSettlement, Member } from "../domain/types";

export interface SharedGroup {
  id: string;
  name: string;
  members: Member[];
  expenses: GroupExpense[];
  settlements: GroupSettlement[];
  rev: number;
  updatedAt: string;
}

export function groupsEndpoint(): string | null {
  const explicit = process.env.NEXT_PUBLIC_GROUPS_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const exchange = process.env.NEXT_PUBLIC_GITHUB_TOKEN_EXCHANGE_URL;
  if (!exchange) return null;
  try {
    return new URL("/groups", exchange).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function groupSyncEnabled(): boolean {
  return groupsEndpoint() !== null;
}

function payloadOf(group: Group) {
  return {
    name: group.name,
    members: group.members.map((member) => ({
      id: member.id,
      name: member.name,
    })),
    expenses: group.expenses,
    settlements: group.settlements,
  };
}

async function readSharedGroup(response: Response): Promise<SharedGroup | null> {
  try {
    const body = (await response.json()) as { group?: SharedGroup };
    return body.group ?? null;
  } catch {
    return null;
  }
}

export async function createRemoteGroup(
  group: Group,
): Promise<SharedGroup | null> {
  const endpoint = groupsEndpoint();
  if (!endpoint) return null;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payloadOf(group)),
  });
  if (!response.ok) return null;
  return readSharedGroup(response);
}

export async function fetchRemoteGroup(
  remoteId: string,
): Promise<SharedGroup | null> {
  const endpoint = groupsEndpoint();
  if (!endpoint) return null;
  const response = await fetch(`${endpoint}/${remoteId}`);
  if (!response.ok) return null;
  return readSharedGroup(response);
}

export type PushResult =
  | { status: "ok"; group: SharedGroup }
  | { status: "conflict"; group: SharedGroup }
  | { status: "error" };

export async function pushRemoteGroup(
  remoteId: string,
  expectedRev: number | undefined,
  group: Group,
): Promise<PushResult> {
  const endpoint = groupsEndpoint();
  if (!endpoint) return { status: "error" };
  const response = await fetch(`${endpoint}/${remoteId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expectedRev, group: payloadOf(group) }),
  });
  if (response.status === 409) {
    const shared = await readSharedGroup(response);
    return shared ? { status: "conflict", group: shared } : { status: "error" };
  }
  if (!response.ok) return { status: "error" };
  const shared = await readSharedGroup(response);
  return shared ? { status: "ok", group: shared } : { status: "error" };
}

export async function joinRemoteGroup(
  remoteId: string,
  member: Member,
): Promise<SharedGroup | null> {
  const endpoint = groupsEndpoint();
  if (!endpoint) return null;
  const response = await fetch(`${endpoint}/${remoteId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ member }),
  });
  if (!response.ok) return null;
  return readSharedGroup(response);
}

function unionById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of [...a, ...b]) {
    if (!seen.has(item.id)) seen.set(item.id, item);
  }
  return Array.from(seen.values());
}

export function mergeSharedIntoLocal(local: Group, shared: SharedGroup): Group {
  return {
    ...local,
    name: shared.name,
    members: unionById(local.members, shared.members),
    expenses: unionById(local.expenses, shared.expenses),
    settlements: unionById(local.settlements, shared.settlements),
    remoteId: shared.id,
    rev: shared.rev,
  };
}

export function sharedToLocal(
  shared: SharedGroup,
  localId: string,
  selfMemberId: string | undefined,
  createdAt: string,
): Group {
  return {
    id: localId,
    name: shared.name,
    members: shared.members,
    expenses: shared.expenses,
    settlements: shared.settlements,
    remoteId: shared.id,
    rev: shared.rev,
    selfMemberId,
    createdAt,
  };
}
