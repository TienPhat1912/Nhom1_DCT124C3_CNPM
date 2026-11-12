import { localizeText } from "@hospital/shared";
import { setApiLocale } from "./runtime";
import { isLocale } from "@hospital/shared";
import { LanguagePicker } from "./LanguagePicker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as Speech from "expo-speech";
import {
  ApiError,
  dateText,
  translator,
  type ApiClient,
  type Configuration,
  type Locale,
  type Session,
  type Step,
  type VisitSummary,
} from "@hospital/shared";
import {
  NativeContext,
  nativeApi,
  restoreSession,
  saveSession,
  useAction,
  useLoad,
  useNative,
  localizedError,
} from "./runtime";
import {
  Badge,
  Btn,
  Card,
  Choice,
  Feedback,
  LoadingState,
  Txt,
  styles,
  colors,
} from "./ui";
import { Auth } from "./Auth";
import { Reception } from "./Reception";
import { DirectionsScreen, Journey, ScanTicket } from "./Journey";
import {
  Help,
  Notifications,
  ProfileScreen,
  Results,
} from "./Records";
type Page =
  | "home"
  | "reception"
  | "journey"
  | "results"
  | "history"
  | "help"
  | "profile"
  | "notifications"
  | "scan"
  | "directions";
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const sessionId = useRef<string | null>(null);
  const [locale, setLanguage] = useState<Locale>("vi");
  const localeOverride = useRef<Locale | null>(null);
  const configGeneration = useRef(0);
  const [config, setConfig] = useState<Configuration | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState<string | null>(null);
  const t = useMemo(() => translator(locale), [locale]);
  const loadConfig = async (language: Locale) => {
    const generation = ++configGeneration.current;
    const value = await nativeApi<Configuration>(
      `/api/config?language=${language}`,
    );
    if (generation === configGeneration.current) setConfig(value);
  };
  useEffect(() => {
    const reload = () => {
      void loadConfig(locale).catch(setError);
    };
    reload();
    const timer = setInterval(reload, 15000);
    return () => {
      configGeneration.current++;
      clearInterval(timer);
    };
  }, [locale]);
  const updateSession = useCallback(async (s: Session | null) => {
    if (sessionId.current !== (s?.sessionId ?? null)) {
      if (sessionId.current) setPending(null);
      sessionId.current = s?.sessionId ?? null;
      // Unmount private screens before waiting on device storage/audio.
      setSession(null);
      await Speech.stop().catch(() => {});
    }
    await saveSession(s);
    setSession(s);
  }, []);
  const setLocale = (language: Locale) => {
    localeOverride.current = language;
    setApiLocale(language);
    configGeneration.current++;
    if (language !== locale) setConfig(null);
    setLanguage(language);
    void SecureStore.setItemAsync("hospital.language", language);
  };
  const load = async () => {
    setError(null);
    try {
      const language = await SecureStore.getItemAsync("hospital.language");
      if (localeOverride.current === null && isLocale(language)) {
        setApiLocale(language);
        setLanguage(language);
      }
      await loadConfig(
        localeOverride.current ?? (isLocale(language) ? language : "vi"),
      );
      const restored = await restoreSession();
      sessionId.current = restored?.sessionId ?? null;
      setSession(restored);
    } catch (e) {
      setError(e);
    } finally {
      setReady(true);
    }
  };
  useEffect(() => {
    void load();
    const link = (url: string) => {
      try {
        const u = new URL(url);
        const requestedLanguage = u.searchParams.get("language");
        if (isLocale(requestedLanguage)) setLocale(requestedLanguage);
        const code =
          new URLSearchParams(u.hash.slice(1)).get("ticket") ??
          u.searchParams.get("ticket");
        if (code) setPending(code);
      } catch {
        /* Unsupported link stays at entry. */
      }
    };
    void Linking.getInitialURL().then((url) => {
      if (url) link(url);
    });
    const listener = Linking.addEventListener("url", (e) => link(e.url));
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!session) return;
    const expiry = new Date(
      session.expiresAt.endsWith("Z")
        ? session.expiresAt
        : session.expiresAt + "Z",
    ).getTime();
    const timer = setTimeout(
      () => {
        void updateSession(null);
        setError(
          new ApiError({ status: 401, title: "sessionExpired", detail: "" }),
        );
      },
      Math.max(0, expiry - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [session, updateSession]);
  const api = useCallback<ApiClient>(
    async (...args) => {
      try {
        return await nativeApi(...args);
      } catch (e) {
        if (e instanceof ApiError && e.problem.title === "sessionExpired") {
          await updateSession(null);
          setError(e);
        }
        throw e;
      }
    },
    [updateSession],
  );
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {!ready ? (
            <ActivityIndicator color={colors.green} style={{ margin: 80 }} />
          ) : !config ? (
            <View style={styles.content}>
              <Txt>{localizedError(error, locale)}</Txt>
              <Btn onPress={() => void load()}>{t("retry")}</Btn>
            </View>
          ) : session ? (
            <NativeContext.Provider
              value={{
                session,
                config,
                locale,
                setLocale,
                updateSession,
                api,
                t,
                scale: 1,
              }}
            >
              <PatientApp
                key={session.sessionId}
                pending={pending}
                clearPending={() => setPending(null)}
              />
            </NativeContext.Provider>
          ) : (
            <>
              <Feedback error={error} locale={locale} />
              <Auth
                locale={locale}
                setLocale={setLocale}
                onSession={updateSession}
              />
            </>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
function PatientApp({
  pending,
  clearPending,
}: {
  pending: string | null;
  clearPending: () => void;
}) {
  const { t, locale, setLocale, session, config, api, updateSession } =
    useNative();
  const [page, setPage] = useState<Page>(
    pending ? "scan" : "home",
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [helpStep, setHelpStep] = useState<string | undefined>();
  const [offset, setOffset] = useState(0);
  const historyPage = useLoad<VisitSummary[]>(
    page === "history" ? `/api/visits?offset=${offset}` : null,
  );
  const visits = useLoad<VisitSummary[]>(
    session.role === "Patient" ? "/api/visits" : null,
    true,
  );
  const action = useAction(api);
  const id =
    selected ??
    visits.data?.find((v) => v.journeyStatus !== "Completed")?.id ??
    visits.data?.[0]?.id ??
    null;
  useEffect(() => {
    const handler = BackHandler.addEventListener("hardwareBackPress", () => {
      if (page === "home") return false;
      setPage("home");
      return true;
    });
    return () => handler.remove();
  }, [page]);
  useEffect(() => {
    if (pending) setPage("scan");
  }, [pending]);
  const choose = (id: string, next: Page = "journey") => {
    setSelected(id);
    setPage(next);
    visits.refresh();
  };
  if (session.role !== "Patient")
    return (
      <View style={styles.content}>
        <Txt>
          {localizeText(
            "Ứng dụng này dành cho bệnh nhân. Nhân viên sử dụng giao diện web.",
            locale,
          )}
        </Txt>
        <Btn
          onPress={async () => {
            if (await action.run("/api/auth/logout")) await updateSession(null);
          }}
        >
          {t("signOut")}
        </Btn>
      </View>
    );
  return (
    <>
      <View style={styles.header}>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <Txt tone="heading">✚ {t("brand")}</Txt>
          <LanguagePicker locale={locale} onChange={setLocale} />
        </View>
      </View>
      <ScrollView
        key={page}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <Feedback error={action.error} locale={locale} />
        {config.demo && <Txt tone="eyebrow">{t("demo")}</Txt>}
        {page !== "home" && (
          <Btn secondary onPress={() => setPage("home")}>
            {t("back")}
          </Btn>
        )}
        {["journey", "results", "history"].includes(page) &&
          visits.data &&
          visits.data.length > 1 && (
            <Card>
              <Txt tone="heading">{t("selectVisit")}</Txt>
              {visits.data.map((v) => (
                <Choice
                  key={v.id}
                  label={`${v.ticketNumber} · ${t(v.status)} / ${t(v.journeyStatus)}`}
                  selected={id === v.id}
                  onPress={() => setSelected(v.id)}
                />
              ))}
            </Card>
          )}
        {page === "home" && (
          <>
            <Txt tone="title">
              {t("hello")}, {session.name || t("Patient")}
            </Txt>
            <Card>
              <Txt tone="heading">{t("yourJourney")}</Txt>
              <LoadingState resource={visits} />
              {id ? (
                <>
                  <Txt>
                    {visits.data?.find((v) => v.id === id)?.ticketNumber}
                  </Txt>
                  <Btn onPress={() => setPage("journey")}>{t("journey")}</Btn>
                </>
              ) : (
                <Txt tone="muted">{t("noVisits")}</Txt>
              )}
              <Btn secondary onPress={() => setPage("reception")}>
                {t("prepare")}
              </Btn>
              <Btn secondary onPress={() => setPage("scan")}>
                {t("scan")}
              </Btn>
            </Card>
            <Card>
              <Btn secondary onPress={() => setPage("notifications")}>
                {t("notifications")}
              </Btn>
              <Btn secondary onPress={() => setPage("history")}>
                {t("history")}
              </Btn>
              <Btn
                secondary
                onPress={() => {
                  setHelpStep(undefined);
                  setPage("help");
                }}
              >
                {t("help")}
              </Btn>
              <Btn
                secondary
                busy={action.busy}
                onPress={async () => {
                  if (await action.run("/api/auth/logout"))
                    await updateSession(null);
                }}
              >
                {t("signOut")}
              </Btn>
            </Card>
          </>
        )}
        {page === "reception" && <Reception onVisit={choose} />}
        {page === "journey" && (
          <Journey
            id={id}
            onScan={() => setPage("scan")}
            onResults={() => setPage("results")}
            onHelp={(step) => {
              setHelpStep(step);
              setPage("help");
            }}
            onDirections={(step) => {
              setStep(step);
              setPage("directions");
            }}
          />
        )}
        {page === "results" && <Results id={id} />}
        {page === "scan" && (
          <ScanTicket
            initialCode={pending}
            onVisit={(id) => {
              clearPending();
              choose(id);
            }}
          />
        )}
        {page === "directions" && id && step && (
          <DirectionsScreen
            visitId={id}
            onHelp={(stepId) => {
              setHelpStep(stepId);
              setPage("help");
            }}
          />
        )}
        {page === "help" && <Help visitId={id} stepId={helpStep} />}
        {page === "notifications" && (
          <Notifications onVisit={(id) => choose(id, "results")} />
        )}
        {page === "profile" && <ProfileScreen />}
        {page === "history" && (
          <>
            <Txt tone="title">{t("history")}</Txt>
            <LoadingState resource={historyPage} />
            {historyPage.data?.length === 0 && <Txt>{t("noVisits")}</Txt>}
            {historyPage.data?.map((v) => (
              <Card key={v.id}>
                <Txt tone="heading">{v.ticketNumber}</Txt>
                <Txt tone="muted">{dateText(v.createdAt, locale)}</Txt>
                <Badge value={v.status} />
                <Badge value={v.journeyStatus} />
                <Btn secondary onPress={() => choose(v.id, "results")}>
                  {t("results")}
                </Btn>
                <Btn secondary onPress={() => choose(v.id)}>
                  {t("journey")}
                </Btn>
              </Card>
            ))}
            <Btn
              secondary
              disabled={offset === 0 || historyPage.loading}
              onPress={() => setOffset(Math.max(0, offset - 100))}
            >
              {t("previousPage")}
            </Btn>
            <Btn
              secondary
              disabled={historyPage.data?.length !== 100 || historyPage.loading}
              onPress={() => setOffset(offset + 100)}
            >
              {t("nextPage")}
            </Btn>
          </>
        )}
      </ScrollView>
      <View style={styles.bottom}>
        {(["home", "journey", "results", "profile"] as Page[]).map((tab) => (
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel={t(tab)}
            accessibilityState={{ selected: page === tab }}
            key={tab}
            onPress={() => setPage(tab)}
            style={[
              styles.tab,
              page === tab && { backgroundColor: colors.pale },
            ]}
          >
            <Txt
              style={{
                fontSize: 11,
                color: page === tab ? colors.green : colors.muted,
                textAlign: "center",
                fontWeight: page === tab ? "700" : "400",
              }}
            >
              {t(tab)}
            </Txt>
          </Pressable>
        ))}
      </View>
    </>
  );
}
