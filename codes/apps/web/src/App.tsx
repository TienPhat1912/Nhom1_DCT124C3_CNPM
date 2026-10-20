import { useEffect, useMemo, useState } from "react";
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
  RuntimeContext,
  useMutation,
  useResource,
  useRuntime,
} from "./runtime";
import Auth from "./Auth";
import {
  Button,
  Empty,
  Feedback,
  Modal,
  Notice,
  ResourceState,
  SectionTitle,
} from "./components";
import { PatientReception } from "./PatientReception";
import { PatientJourney } from "./PatientJourney";
import {
  HelpPanel,
  LinkAccount,
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
  const [locale, setLocale] = useState<Locale>(() =>
    localStorage.getItem("hospital.language") === "en" ? "en" : "vi",
  );
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const config = useResource<Configuration>("/api/config");
  const t = useMemo(() => translator(locale), [locale]);
  useEffect(() => {
    document.documentElement.lang = locale;
    localStorage.setItem("hospital.language", locale);
  }, [locale]);
  useEffect(() => {
    void api<Session>("/api/auth/session")
      .then(setSession)
      .catch(() => {})
      .finally(() => setReady(true));
    const expire = () => {
      setSession(null);
      setExpired(true);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
    window.addEventListener("hospital:expired", expire);
    return () => window.removeEventListener("hospital:expired", expire);
  }, []);
  useEffect(() => {
    if (!session) return;
    const remaining =
      new Date(
        session.expiresAt + (session.expiresAt.endsWith("Z") ? "" : "Z"),
      ).getTime() - Date.now();
    const timer = setTimeout(
      () => window.dispatchEvent(new Event("hospital:expired")),
      Math.max(0, remaining),
    );
    return () => clearTimeout(timer);
  }, [session]);
  if (location.pathname === "/entry") return <HospitalEntry locale={locale} />;
  if (!ready)
    return (
      <div className="boot-screen">
        <HeartPulse />
        {t("loading")}
      </div>
    );
  if (!session)
    return (
      <Auth
        locale={locale}
        setLocale={setLocale}
        onSession={(s) => {
          setSession(s);
          setExpired(false);
        }}
        expired={expired}
      />
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
      value={{ session, setSession, config: config.data, locale, setLocale, t }}
    >
      <Workspace key={session.sessionId} />
    </RuntimeContext.Provider>
  );
}
function Workspace() {
  const { session, setSession, config, locale, setLocale, t } = useRuntime();
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
  const [link, setLink] = useState(false);
  const [menu, setMenu] = useState(false);
  const [font, setFont] = useState(1);
  const [pendingQr, setPendingQr] = useState(() =>
    new URLSearchParams(location.hash.slice(1)).get("ticket"),
  );
  const [offset, setOffset] = useState(0);
  const historyPage = useResource<VisitSummary[]>(page === "history" ? `/api/visits?offset=${offset}` : null);
  const visits = useResource<VisitSummary[]>(
    session.role !== "Admin" ? `/api/visits?offset=${patient ? 0 : offset}` : null,
    true,
  );
  const mutation = useMutation();
  const visitId =
    selected ??
    visits.data?.find((v) => v.journeyStatus !== "Completed")?.id ??
    visits.data?.[0]?.id ??
    null;
  const selectVisit = (id: string, target: Page = "journey") => {
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
        ...(["Reception", "Service"].includes(session.role)
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
              {session.isGuest
                ? ` · ${locale === "vi" ? "Khách" : "Guest"}`
                : ""}
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
            aria-label={menu ? t("close") : "Menu"}
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
                onChange={(e) => setLocale(e.target.value as Locale)}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
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
          {config.demo && (
            <div className="demo-label">
              <span />
              {t("demo")}
            </div>
          )}
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
                      history.replaceState(null, "", location.pathname);
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
                      onChange={(e) => setSelected(e.target.value)}
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
                <PatientReception onVisit={selectVisit} />
              )}
              {page === "journey" && (
                <PatientJourney
                  id={visitId}
                  onSelected={selectVisit}
                  onResults={() => setPage("results")}
                  onLink={() => setLink(true)}
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
                    <Button variant="quiet" disabled={offset === 0 || historyPage.loading} onClick={() => setOffset(Math.max(0, offset - 100))}>{t("previousPage")}</Button>
                    <Button variant="quiet" disabled={historyPage.data?.length !== 100 || historyPage.loading} onClick={() => setOffset(offset + 100)}>{t("nextPage")}</Button>
                  </div>
                </>
              )}
              {page === "assistance" && (
                <div className="panel">
                  <SectionTitle title={t("assistance")} />
                  <HelpPanel visitId={visitId} />
                </div>
              )}
              {page === "profile" && (
                <ProfilePanel onLink={() => setLink(true)} />
              )}
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
                <Button variant="quiet" disabled={offset === 0 || visits.loading} onClick={() => { setSelected(null); setOffset(Math.max(0, offset - 100)); }}>{t("previousPage")}</Button>
                <Button variant="quiet" disabled={visits.data?.length !== 100 || visits.loading} onClick={() => { setSelected(null); setOffset(offset + 100); }}>{t("nextPage")}</Button>
              </div>
              <StaffClinical id={visitId} />
            </>
          )}
          <footer>
            {t("brand")} · {t("tagline")}
          </footer>
        </main>
      </div>
      {link && (
        <Modal title={t("linkAccount")} onClose={() => setLink(false)}>
          <LinkAccount
            visitId={visitId}
            onCancel={() => setLink(false)}
            onDone={(s, id) => {
              setLink(false);
              if (id) {
                setSelected(id);
                history.replaceState(
                  null,
                  "",
                  `${location.pathname}#visit=${id}`,
                );
              }
              setSession(s);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
