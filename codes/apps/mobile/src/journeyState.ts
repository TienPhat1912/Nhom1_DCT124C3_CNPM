import type { Configuration, Session } from "@hospital/shared";

type Storage = {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
};
export type JourneySnapshot<T = unknown> = {
  path: string;
  data: T;
  updatedAt: string;
};
type Document = {
  session: Session;
  configs: Record<string, Configuration>;
  snapshots: JourneySnapshot[];
};
export function resourceIdentity(path: string) {
  const url = new URL(path, "http://hospital.local");
  url.searchParams.delete("language");
  return url.href;
}
function version(data: unknown) {
  return data && typeof data === "object" && "version" in data
    ? Number(data.version)
    : 0;
}
export function olderSnapshot(
  previous: JourneySnapshot | null,
  path: string,
  data: unknown,
) {
  return (
    !!previous &&
    resourceIdentity(previous.path) === resourceIdentity(path) &&
    version(previous.data) > version(data)
  );
}
export function sessionValid(session: Session) {
  const expires = session.expiresAt;
  return (
    session.role === "Patient" &&
    Date.parse(/Z$|[+-]\d\d:\d\d$/.test(expires) ? expires : expires + "Z") >
      Date.now()
  );
}

// SecureStore entries stay below 2 KiB even for non-ASCII guidance. Two banks
// keep the last committed document intact if Android kills a write midway.
export function createJourneyStore(storage: Storage) {
  const root = "hospital.journey";
  let pending: Promise<unknown> = Promise.resolve();
  let active: string | null = null;
  let generation = 0;
  let document: Document | null | undefined;
  const serial = <T>(action: () => Promise<T>): Promise<T> => {
    const next = pending.catch(() => {}).then(action);
    pending = next;
    return next;
  };
  const count = async (bank: number) =>
    Number(await storage.getItemAsync(`${root}.${bank}.count`)) || 0;
  async function clearBank(bank: number) {
    const size = await count(bank);
    for (let i = 0; i < size; i++)
      await storage.deleteItemAsync(`${root}.${bank}.${i}`);
    await storage.deleteItemAsync(`${root}.${bank}.count`);
  }
  async function read(): Promise<Document | null> {
    if (document !== undefined) return document;
    const pointer = await storage.getItemAsync(root);
    if (pointer === null) return (document = null);
    const bank = Number(pointer);
    if (bank !== 0 && bank !== 1) return (document = null);
    const size = await count(bank);
    if (size < 1 || size > 4096) return (document = null);
    let raw = "";
    for (let i = 0; i < size; i++) {
      const part = await storage.getItemAsync(`${root}.${bank}.${i}`);
      if (part === null) return (document = null);
      raw += part;
    }
    try {
      return (document = JSON.parse(raw) as Document);
    } catch {
      return (document = null);
    }
  }
  async function write(value: Document) {
    const previous = await storage.getItemAsync(root);
    const bank = previous === "0" ? 1 : 0;
    await clearBank(bank);
    const raw = JSON.stringify(value);
    const points = Array.from(raw);
    const chunks: string[] = [];
    for (let i = 0; i < points.length; i += 400)
      chunks.push(points.slice(i, i + 400).join(""));
    if (chunks.length > 4096) throw new Error("Journey snapshot is too large");
    await storage.setItemAsync(`${root}.${bank}.count`, String(chunks.length));
    for (let i = 0; i < chunks.length; i++)
      await storage.setItemAsync(`${root}.${bank}.${i}`, chunks[i]);
    await storage.setItemAsync(root, String(bank));
    document = value;
    if (previous !== null) await clearBank(1 - bank);
  }
  return {
    readSession: () => serial(async () => (await read())?.session ?? null),
    open(session: Session) {
      active = session.sessionId;
      const epoch = ++generation;
      return serial(async () => {
        const previous = await read();
        if (epoch !== generation) return;
        // Tokens remain only in hospital.token, never duplicated in snapshots.
        const safe = { ...session, token: null };
        await write(
          previous?.session.sessionId === active
            ? { ...previous, session: safe }
            : { session: safe, configs: {}, snapshots: [] },
        );
      });
    },
    clear() {
      active = null;
      generation++;
      return serial(async () => {
        document = null;
        await storage.deleteItemAsync(root);
        await clearBank(0);
        await clearBank(1);
      });
    },
    readConfig(language: string) {
      const id = active;
      return serial(async () => {
        const value = await read();
        return id && active === id && value?.session.sessionId === id
          ? (value.configs[language] ?? null)
          : null;
      });
    },
    saveConfig(language: string, config: Configuration) {
      const epoch = generation;
      return serial(async () => {
        const value = await read();
        if (
          active &&
          epoch === generation &&
          value?.session.sessionId === active
        )
          await write({
            ...value,
            configs: { ...value.configs, [language]: config },
          });
      });
    },
    read<T>(
      sessionId: string,
      path: string,
    ): Promise<JourneySnapshot<T> | null> {
      return serial(async () => {
        const value = await read();
        if (active !== sessionId || value?.session.sessionId !== sessionId)
          return null;
        const matching = value.snapshots.filter(
          (s) => resourceIdentity(s.path) === resourceIdentity(path),
        );
        const newest = matching.reduce<JourneySnapshot | null>(
          (best, item) =>
            !best ||
            version(item.data) > version(best.data) ||
            (version(item.data) === version(best.data) && item.path === path)
              ? item
              : best,
          null,
        );
        return newest as JourneySnapshot<T> | null;
      });
    },
    discard(sessionId: string, path: string) {
      return serial(async () => {
        const value = await read();
        if (active !== sessionId || value?.session.sessionId !== sessionId)
          return;
        await write({
          ...value,
          snapshots: value.snapshots.filter(
            (s) => resourceIdentity(s.path) !== resourceIdentity(path),
          ),
        });
      });
    },
    save(sessionId: string, snapshot: JourneySnapshot) {
      const epoch = generation;
      return serial(async () => {
        const value = await read();
        if (
          active !== sessionId ||
          epoch !== generation ||
          value?.session.sessionId !== sessionId
        )
          return;
        const previous = value.snapshots.find(
          (s) => resourceIdentity(s.path) === resourceIdentity(snapshot.path),
        );
        if (olderSnapshot(previous ?? null, snapshot.path, snapshot.data))
          return;
        await write({
          ...value,
          snapshots: [
            snapshot,
            ...value.snapshots.filter((s) => s.path !== snapshot.path),
          ].slice(0, 8),
        });
      });
    },
  };
}
