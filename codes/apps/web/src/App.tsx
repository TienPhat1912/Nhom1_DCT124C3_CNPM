import { ApiError, languages, normalizeLocale, displayLocale, isLegacyLocale } from "@hospital/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  ClipboardList,
  HeartPulse,
  History,
  House,
  Languages,
  LogOut,
  Menu,
  MessageCircle,
  Route,
  Settings2,
  ShieldCheck,
  UserRound,
  FileText,
  X,
} from "lucide-react";
import {
  translator,
  type Configuration,
  type Locale,
  type Session,
  type VisitSummary,
} from "@hospital/shared";
import {
  api,
  clearOfflineSnapshots,
  rememberSession,
  offlineSession,
  RuntimeContext,
  useMutation,
  useResource,
  useRuntime,
  WebPresence,
  stopWebPresence,
} from "./runtime";
import Auth from "./Auth";
import {
  Button,
  Empty,
  Feedback,
  Notice,
  ResourceState,
  SectionTitle,
} from "./components";
import { PatientReception } from "./PatientReception";
import { PatientJourney } from "./PatientJourney";
import {
  HelpPanel,
  NotificationsPanel,
  Overview,
  ProfilePanel,
  ResultsPanel,
  VisitRow,
} from "./PatientRecords";
import StaffReception from "./StaffReception";
import StaffClinical from "./StaffClinical";
import StaffSupport from "./StaffSupport";
import Admin from "./Admin";
import { HospitalEntry } from "./HospitalEntry";
type Page =
  | "home"
  | "reception"
  | "journey"
  | "results"
  | "history"
  | "assistance"
  | "profile"
  | "notifications"
  | "workspace";
export default function App() {
  const [locale, updateLocale] = useState<Locale>(() =>
    displayLocale(new URLSearchParams(location.search).get("language") ?? localStorage.getItem("hospital.language")),
  );
  const [legacyLanguage, setLegacyLanguage] = useState(() =>
    isLegacyLocale(new URLSearchParams(location.search).get("language") ?? localStorage.getItem("hospital.language")),
  );
  const setLocale = (language: Locale) => {
    setLegacyLanguage(false);
    if (new URLSearchParams(location.search).has("language")) {
      const url = new URL(location.href); url.searchParams.set("language", language);
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
    localStorage.setItem("hospital.language", language);
    updateLocale(language);
  };
  const [session, setSession] = useState<Session | null>(null);
  const sessionId = useRef<string | null>(null);
  const updateSession = useCallback((next: Session | null) => {
    if (sessionId.current !== (next?.sessionId ?? null)) {
      stopWebPresence();
      window.speechSynthesis?.cancel();
      // A previous patient's selection must not continue into another session.
      if (sessionId.current)
        history.replaceState(null, "", location.pathname + location.search);
    }
    if (sessionId.current !== (next?.sessionId ?? null))
      clearOfflineSnapshots();
    if (next) rememberSession(next);
    sessionId.current = next?.sessionId ?? null;
    setSession(next);
  }, []);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const config = useResource<Configuration>(
    `/api/config?language=${locale}`,
    true,
    true,
    "config",
  );
  const t = useMemo(() => translator(locale), [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
    if (!legacyLanguage) localStorage.setItem("hospital.language", locale);
  }, [locale, legacyLanguage]);
  useEffect(() => {
    void api<Session>("/api/auth/session")
      .then((s) => {
        sessionId.current = s.sessionId;
        rememberSession(s);
        setSession(s);
      })
      .catch((error: unknown) => {
        // An HTTP auth denial is authoritative. Only transport failures may
        // restore an unexpired patient shell; server commands still need auth.
        if (error instanceof ApiError && error.problem.status === 0) {
          const cached = offlineSession();
          sessionId.current = cached?.sessionId ?? null;
          setSession(cached);
        } else clearOfflineSnapshots();
      })
      .finally(() => setReady(true));
    const expire = () => {
      updateSession(null);
      setExpired(true);
    };
    window.addEventListener("hospital:expired", expire);
    return () => window.removeEventListener("hospital:expired", expire);
  }, [updateSession]);
  useEffect(() => {
    if (!session) return;
    const expiresAt = new Date(
      session.expiresAt + (session.expiresAt.endsWith("Z") ? "" : "Z"),
    ).getTime();
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      const remaining = expiresAt - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) {
        window.dispatchEvent(new Event("hospital:expired"));
        return;
      }
      // Browsers overflow delays above a signed 32-bit integer. Recheck long
      // sessions in chunks, expiring only when their actual deadline is reached.
      timer = setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647));
    };
    checkExpiry();
    return () => clearTimeout(timer);
  }, [session]);
  const languageNotice = legacyLanguage ? <Notice>{t("legacyLanguageNotice")}</Notice> : null;
  if (location.pathname === "/entry") return <>{languageNotice}<HospitalEntry locale={locale} setLocale={setLocale} /></>;
  if (!ready)
    return (
      <div className="boot-screen">
        <HeartPulse />
        {t("loading")}
      </div>
    );
  if (!session)
    return (
      <>{languageNotice}
      <Auth
        locale={locale}
        setLocale={setLocale}
        onSession={(s, visitId) => {
          updateSession(s);
          if (visitId)
            history.replaceState(
              null,
              "",
              `#visit=${encodeURIComponent(visitId)}`,
            );
          setExpired(false);
        }}
        expired={expired}
      />
      </>
    );
  if (!config.data)
    return (
      <div className="boot-screen">
        {config.error ? (
          <>
            <p>{t("connection")}</p>
            <Button onClick={config.refresh}>{t("retry")}</Button>
          </>
        ) : (
          t("loading")
        )}
      </div>
    );
  return (
    <RuntimeContext.Provider
      value={{
        session,
        setSession: updateSession,
        config: config.data,
        configLocale: config.dataLocale ?? locale,
        locale,
        setLocale,
        t,
      }}
    >
      <WebPresence session={session} />
      {languageNotice}
      <Workspace key={session.sessionId} />
    </RuntimeContext.Provider>
  );
}
function Workspace() {
  const { session, setSession, locale, setLocale, t, config } = useRuntime();
  const patient = session.role === "Patient";
  const [page, setPage] = useState<Page>(
    patient
      ? new URLSearchParams(location.hash.slice(1)).has("visit")
        ? "journey"
        : "home"
      : "workspace",
  );
  const [selected, setSelected] = useState<string | null>(() =>
    new URLSearchParams(location.hash.slice(1)).get("visit"),
  );
  const [menu, setMenu] = useState(false);
  const [font, setFont] = useState(1);
  const [pendingQr, setPendingQr] = useState(() =>
    new URLSearchParams(location.hash.slice(1)).get("ticket"),
  );
  const [offset, setOffset] = useState(0);
  const historyPage = useResource<VisitSummary[]>(
    page === "history" ? `/api/visits?offset=${offset}` : null,
  );
  const visits = useResource<VisitSummary[]>(
    session.role !== "Admin"
      ? `/api/visits?offset=${patient ? 0 : offset}`
      : null,
    true,
  );
  const mutation = useMutation();
  const visitId =
    selected ??
    visits.data?.find((v) => v.journeyStatus !== "Completed")?.id ??
    visits.data?.[0]?.id ??
    null;
  useEffect(() => {
    if (patient && page === "journey" && visitId && !selected) {
      setSelected(visitId);
      window.history.replaceState(
        null,
        "",
        `#visit=${encodeURIComponent(visitId)}`,
      );
    }
  }, [patient, page, visitId, selected]);
  const selectVisit = (id: string, target: Page = "journey") => {
    window.history.replaceState(null, "", `#visit=${encodeURIComponent(id)}`);
    setSelected(id);
    setPage(target);
    setMenu(false);
    visits.refresh();
  };
  useEffect(() => {
    const read = () =>
      setPendingQr(new URLSearchParams(location.hash.slice(1)).get("ticket"));
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    document.documentElement.style.fontSize = `${font * 100}%`;
    return () => {
      document.documentElement.style.fontSize = "";
    };
  }, [font]);
  const nav = patient
    ? ([
        ["home", House],
        ["reception", ClipboardList],
        ["journey", Route],
        ["results", FileText],
        ["history", History],
        ["assistance", MessageCircle],
        ["profile", UserRound],
      ] as const)
    : ([
        ["workspace", session.role === "Admin" ? Settings2 : ClipboardList],
        ...(session.role === "Reception"
          ? [["assistance", MessageCircle] as const]
          : []),
      ] as const);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setPage(patient ? "home" : "workspace");
          }}
        >
          <span className="brand-icon">
            <HeartPulse />
          </span>
          <span>
            {t("brand")}
            <small>{t("tagline")}</small>
          </span>
        </a>
        <span className="sidebar-label">
          {t(patient ? "Patient" : "staffWorkspace")}
        </span>
        <nav>
          {nav.map(([key, Icon]) => (
            <button
              className={page === key ? "active" : ""}
              key={key}
              onClick={() => {
                setPage(key as Page);
                setMenu(false);
              }}
            >
              <Icon size={20} />
              <span>{t(key === "workspace" ? session.role : key)}</span>
              {page === key && <ChevronRight size={15} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note">
            <ShieldCheck size={18} />
            <span>
              {t(session.role)}
              {session.isGuest ? ` · ${t("guestLabel")}` : ""}
            </span>
          </div>
          <button
            className="logout"
            disabled={mutation.busy}
            onClick={async () => {
              if (await mutation.run("/api/auth/logout")) {
                if ("speechSynthesis" in window)
                  window.speechSynthesis.cancel();
                setSession(null);
              }
            }}
          >
            <LogOut size={18} />
            {t("signOut")}
          </button>
        </div>
      </aside>
      {menu && (
        <button
          className="sidebar-overlay"
          aria-label={t("close")}
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label={menu ? t("close") : t("menu")}
            onClick={() => setMenu((s) => !s)}
          >
            {menu ? <X /> : <Menu />}
          </button>
          <div className="breadcrumb">
            {t("hospital")}
            <ChevronRight size={14} />
            <strong>{t(page === "workspace" ? session.role : page)}</strong>
          </div>
          <div className="top-actions">
            <label className="language-picker">
              <Languages size={17} />
              <select
                aria-label={t("language")}
                value={locale}
                onChange={(e) => setLocale(normalizeLocale(e.target.value))}
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="icon-button text-scale"
              aria-label={t("fontSize")}
              onClick={() => setFont((f) => (f >= 1.3 ? 1 : f + 0.15))}
            >
              A<span>+</span>
            </button>
            {patient && (
              <button
                className="icon-button"
                aria-label={t("notifications")}
                onClick={() => setPage("notifications")}
              >
                <Bell size={20} />
              </button>
            )}
            <span className="avatar">
              {(session.name || session.role).slice(0, 1)}
            </span>
          </div>
        </header>
        <main id="main">
          <Feedback error={mutation.error} locale={locale} />
          {pendingQr && patient && (
            <Notice>
              {t("ticketQr")}
              <div className="actions">
                <Button
                  busy={mutation.busy}
                  onClick={async () => {
                    const result = await mutation.run<{ visitId: string }>(
                      "/api/tickets/redeem",
                      { code: pendingQr },
                    );
                    if (result) {
                      selectVisit(result.visitId);
                      setPendingQr(null);
                    }
                  }}
                >
                  {t("activate")}
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setPendingQr(null);
                    history.replaceState(null, "", location.pathname);
                  }}
                >
                  {t("cancel")}
                </Button>
              </div>
            </Notice>
          )}
          {patient ? (
            <>
              {["journey", "results", "history"].includes(page) &&
                visits.data &&
                visits.data.length > 1 && (
                  <label className="visit-picker">
                    {t("selectVisit")}
                    <select
                      value={visitId ?? ""}
                      onChange={(e) => selectVisit(e.target.value, page)}
                    >
                      {visits.data.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.ticketNumber} · {t(v.status)} /{" "}
                          {t(v.journeyStatus)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              {page === "home" && (
                <>
                  <ResourceState resource={visits} />
                  <Overview
                    visits={visits.data}
                    onSelect={selectVisit}
                    onPrepare={() => setPage("reception")}
                  />
                </>
              )}
              {page === "reception" && (
                <PatientReception
                  onVisit={selectVisit}
                  onProfile={() => setPage("profile")}
                />
              )}
              {page === "journey" && (
                <PatientJourney
                  id={visitId}
                  onSelected={selectVisit}
                  onResults={() => setPage("results")}
                />
              )}
              {page === "results" && <ResultsPanel id={visitId} />}
              {page === "history" && (
                <>
                  <SectionTitle title={t("history")} />
                  <ResourceState resource={historyPage} />
                  {historyPage.data?.length === 0 ? (
                    <Empty text={t("noVisits")} />
                  ) : (
                    <div className="panel">
                      {historyPage.data?.map((v) => (
                        <VisitRow
                          key={v.id}
                          visit={v}
                          onClick={() => selectVisit(v.id, "results")}
                        />
                      ))}
                    </div>
                  )}
                  <div className="actions">
                    <Button
                      variant="quiet"
                      disabled={offset === 0 || historyPage.loading}
                      onClick={() => setOffset(Math.max(0, offset - 100))}
                    >
                      {t("previousPage")}
                    </Button>
                    <Button
                      variant="quiet"
                      disabled={
                        historyPage.data?.length !== 100 || historyPage.loading
                      }
                      onClick={() => setOffset(offset + 100)}
                    >
                      {t("nextPage")}
                    </Button>
                  </div>
                </>
              )}
              {page === "assistance" && (
                <div className="panel">
                  <SectionTitle title={t("assistance")} />
                  <HelpPanel visitId={visitId} />
                </div>
              )}
              {page === "profile" && <ProfilePanel />}
              {page === "notifications" && (
                <NotificationsPanel
                  onVisit={(id) => selectVisit(id, "results")}
                />
              )}
            </>
          ) : page === "assistance" ? (
            <StaffSupport />
          ) : session.role === "Admin" ? (
            <Admin />
          ) : session.role === "Reception" ? (
            <StaffReception />
          ) : ["Doctor", "Service", "Cashier"].includes(session.role) &&
            config.prdV2Enabled ? (
            <StaffClinical id={null} />
          ) : (
            <>
              {visits.data && (
                <label className="visit-picker">
                  {t("assignedVisits")}
                  <select
                    value={visitId ?? ""}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="">{t("selectVisit")}</option>
                    {visits.data.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.ticketNumber} · {v.patientName} · {t(v.status)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <ResourceState resource={visits} />
              <div className="actions">
                <Button
                  variant="quiet"
                  disabled={offset === 0 || visits.loading}
                  onClick={() => {
                    setSelected(null);
                    setOffset(Math.max(0, offset - 100));
                  }}
                >
                  {t("previousPage")}
                </Button>
                <Button
                  variant="quiet"
                  disabled={visits.data?.length !== 100 || visits.loading}
                  onClick={() => {
                    setSelected(null);
                    setOffset(offset + 100);
                  }}
                >
                  {t("nextPage")}
                </Button>
              </div>
              <StaffClinical id={visitId} />
            </>
          )}
          <footer>
            {t("brand")} · {t("tagline")}
          </footer>
        </main>
      </div>
    </div>
  );
}
