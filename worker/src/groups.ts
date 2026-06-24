export interface GroupsEnv {
  GROUPS?: KVNamespace;
}

interface SharedMember {
  id: string;
  name: string;
}

interface SharedGroup {
  id: string;
  name: string;
  members: SharedMember[];
  expenses: unknown[];
  settlements: unknown[];
  rev: number;
  updatedAt: string;
}

const MAX_BYTES = 256 * 1024;

function keyFor(id: string): string {
  return `group:${id}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeMembers(value: unknown): SharedMember[] {
  if (!Array.isArray(value)) return [];
  const members: SharedMember[] = [];
  for (const item of value) {
    if (
      isRecord(item) &&
      typeof item.id === "string" &&
      typeof item.name === "string"
    ) {
      members.push({ id: item.id, name: item.name });
    }
  }
  return members;
}

function sanitizeList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function readGroup(
  env: GroupsEnv,
  id: string,
): Promise<SharedGroup | null> {
  if (!env.GROUPS) return null;
  const raw = await env.GROUPS.get(keyFor(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SharedGroup;
  } catch {
    return null;
  }
}

async function writeGroup(env: GroupsEnv, group: SharedGroup): Promise<void> {
  if (!env.GROUPS) return;
  await env.GROUPS.put(keyFor(group.id), JSON.stringify(group));
}

interface GroupsResult {
  status: number;
  body: unknown;
}

export async function handleGroups(
  request: Request,
  env: GroupsEnv,
  pathname: string,
): Promise<GroupsResult> {
  if (!env.GROUPS) {
    return { status: 503, body: { error: "Group sync is not configured" } };
  }

  const segments = pathname.split("/").filter(Boolean); // ["groups", id?, "join"?]
  const id = segments[1];
  const action = segments[2];

  if (request.method === "POST" && !id) {
    return createGroup(request, env);
  }
  if (request.method === "GET" && id && !action) {
    const group = await readGroup(env, id);
    if (!group) return { status: 404, body: { error: "Group not found" } };
    return { status: 200, body: { group } };
  }
  if (request.method === "PUT" && id && !action) {
    return replaceGroup(request, env, id);
  }
  if (request.method === "POST" && id && action === "join") {
    return joinGroup(request, env, id);
  }
  return { status: 404, body: { error: "Not found" } };
}

async function createGroup(
  request: Request,
  env: GroupsEnv,
): Promise<GroupsResult> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }
  if (!isRecord(body) || typeof body.name !== "string" || !body.name.trim()) {
    return { status: 400, body: { error: "Missing name" } };
  }
  const members = sanitizeMembers(body.members);
  if (members.length === 0) {
    return { status: 400, body: { error: "At least one member required" } };
  }
  const group: SharedGroup = {
    id: crypto.randomUUID(),
    name: body.name.trim().slice(0, 120),
    members,
    expenses: sanitizeList(body.expenses),
    settlements: sanitizeList(body.settlements),
    rev: 1,
    updatedAt: new Date().toISOString(),
  };
  if (JSON.stringify(group).length > MAX_BYTES) {
    return { status: 413, body: { error: "Group too large" } };
  }
  await writeGroup(env, group);
  return { status: 200, body: { group } };
}

async function replaceGroup(
  request: Request,
  env: GroupsEnv,
  id: string,
): Promise<GroupsResult> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }
  const current = await readGroup(env, id);
  if (!current) return { status: 404, body: { error: "Group not found" } };
  if (!isRecord(body) || !isRecord(body.group)) {
    return { status: 400, body: { error: "Missing group" } };
  }
  const expectedRev = body.expectedRev;
  if (typeof expectedRev === "number" && expectedRev !== current.rev) {
    return { status: 409, body: { group: current } };
  }
  const incoming = body.group;
  const next: SharedGroup = {
    id: current.id,
    name:
      typeof incoming.name === "string" && incoming.name.trim()
        ? incoming.name.trim().slice(0, 120)
        : current.name,
    members: sanitizeMembers(incoming.members),
    expenses: sanitizeList(incoming.expenses),
    settlements: sanitizeList(incoming.settlements),
    rev: current.rev + 1,
    updatedAt: new Date().toISOString(),
  };
  if (next.members.length === 0) next.members = current.members;
  if (JSON.stringify(next).length > MAX_BYTES) {
    return { status: 413, body: { error: "Group too large" } };
  }
  await writeGroup(env, next);
  return { status: 200, body: { group: next } };
}

async function joinGroup(
  request: Request,
  env: GroupsEnv,
  id: string,
): Promise<GroupsResult> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, body: { error: "Invalid JSON" } };
  }
  const current = await readGroup(env, id);
  if (!current) return { status: 404, body: { error: "Group not found" } };
  if (!isRecord(body) || !isRecord(body.member)) {
    return { status: 400, body: { error: "Missing member" } };
  }
  const member = sanitizeMembers([body.member])[0];
  if (!member) return { status: 400, body: { error: "Invalid member" } };
  const exists = current.members.some((m) => m.id === member.id);
  const next: SharedGroup = exists
    ? current
    : {
        ...current,
        members: [...current.members, member],
        rev: current.rev + 1,
        updatedAt: new Date().toISOString(),
      };
  if (!exists) await writeGroup(env, next);
  return { status: 200, body: { group: next } };
}
