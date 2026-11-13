import type {
  Locale,
  LocaleV2,
  RegistrationRequestInputV2,
} from "@hospital/shared";

export type ReceptionState = {
  contact: string | null;
  preferredDepartmentId: string | null;
  description: string;
  sourceLanguage: LocaleV2 | "";
  requestId: string | null;
  requestContract: "prd-v2" | "legacy";
  pending: { key: string; body: RegistrationRequestInputV2 } | null;
};
export function emptyReception(locale: Locale): ReceptionState {
  return {
    contact: null,
    preferredDepartmentId: null,
    description: "",
    sourceLanguage: ["vi", "en", "zh", "ja"].includes(locale)
      ? (locale as LocaleV2)
      : "",
    requestId: null,
    requestContract: "prd-v2",
    pending: null,
  };
}
type Storage = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};
// Serialize device writes so a slow earlier keystroke cannot overwrite a newer draft.
// Keys are session-scoped: another Guest/account/recovery session never inherits a draft.
export function createReceptionStore(storage: Storage) {
  const writes = new Map<string, Promise<void>>();
  const key = (sessionId: string, kind: string) =>
    `hospital.${kind}.${sessionId}`;
  function write(name: string, action: () => Promise<void>) {
    const next = (writes.get(name) ?? Promise.resolve())
      .catch(() => {})
      .then(action);
    writes.set(name, next);
    void next
      .finally(() => {
        if (writes.get(name) === next) writes.delete(name);
      })
      .catch(() => {});
    return next;
  }
  async function read(name: string) {
    await writes.get(name);
    return storage.getItemAsync(name);
  }
  return {
    async read(sessionId: string, locale: Locale): Promise<ReceptionState> {
      const raw = await read(key(sessionId, "reception"));
      return raw ? (JSON.parse(raw) as ReceptionState) : emptyReception(locale);
    },
    save: (sessionId: string, state: ReceptionState) =>
      write(key(sessionId, "reception"), () =>
        storage.setItemAsync(
          key(sessionId, "reception"),
          JSON.stringify(state),
        ),
      ),
    readVisit: (sessionId: string) => read(key(sessionId, "visit")),
    saveVisit: (sessionId: string, id: string) =>
      write(key(sessionId, "visit"), () =>
        storage.setItemAsync(key(sessionId, "visit"), id),
      ),
    clear: (sessionId: string) =>
      Promise.all(
        ["reception", "visit"].map((kind) =>
          write(key(sessionId, kind), () =>
            storage.deleteItemAsync(key(sessionId, kind)),
          ),
        ),
      ),
  };
}

export function visitFromEntry(url: string): string | null {
  try {
    const uri = new URL(url);
    const value =
      new URLSearchParams(uri.hash.slice(1)).get("visit") ??
      uri.searchParams.get("visit");
    return value && /^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(value)
      ? value
      : null;
  } catch {
    return null;
  }
}
