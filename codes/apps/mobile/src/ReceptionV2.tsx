import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  dateText,
  languages,
  type ApiProblemV2,
  type Profile,
  type ReceptionRequest,
  type RegistrationRequestInputV2,
  type RegistrationRequestV2,
  type RequestSummary,
} from "@hospital/shared";
import {
  Badge,
  Btn,
  Card,
  Choice,
  Feedback,
  Input,
  LoadingState,
  Txt,
} from "./ui";
import { receptionStore, useLoad, useNative } from "./runtime";
import type { ReceptionState } from "./receptionState";

export function ReceptionV2({
  onVisit,
  onProfile,
}: {
  onVisit: (id: string) => void;
  onProfile?: () => void;
}) {
  const { api, config, locale, session, t } = useNative();
  const [draft, setDraft] = useState<ReceptionState | null>(null);
  const current = useRef<ReceptionState | null>(null);
  const alive = useRef(true);
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [invalid, setInvalid] = useState(false);
  const [offset, setOffset] = useState(0);
  const [history, setHistory] = useState(false);
  const [legacyOffset, setLegacyOffset] = useState(0);
  const opened = useRef<string | null>(null);
  const profile = useLoad<Profile>("/api/auth/profile");
  const rows = useLoad<RegistrationRequestV2[]>(
    `/api/v2/requests?offset=${offset}`,
    true,
  );
  const detail = useLoad<RegistrationRequestV2>(
    draft?.requestId && draft.requestContract === "prd-v2"
      ? `/api/v2/requests/${draft.requestId}`
      : null,
    true,
  );
  const oldRows = useLoad<
    (RequestSummary & { sourceLanguage?: string | null })[]
  >(history ? `/api/requests?offset=${legacyOffset}` : null);
  const oldDetail = useLoad<ReceptionRequest>(
    draft?.requestId && draft.requestContract === "legacy"
      ? `/api/requests/${draft.requestId}`
      : null,
  );
  useEffect(() => {
    alive.current = true;
    void receptionStore
      .read(session.sessionId, locale)
      .then((value) => {
        if (alive.current) {
          current.current = value;
          setDraft(value);
        }
      })
      .catch(setError);
    return () => {
      alive.current = false;
    };
    // Initial source language belongs to this draft, not subsequent UI locale changes.
  }, [session.sessionId]);
  const update = async (patch: Partial<ReceptionState>) => {
    if (!current.current) return;
    const next = { ...current.current, ...patch };
    current.current = next;
    setDraft(next);
    await receptionStore.save(session.sessionId, next);
  };
  const edit = (patch: Partial<ReceptionState>) => {
    void update(patch).catch(setError);
  };
  const confirmed = detail.data?.visitId;
  useEffect(() => {
    if (confirmed && opened.current !== confirmed) {
      opened.current = confirmed;
      onVisit(confirmed);
    }
  }, [confirmed, onVisit]);
  const problem =
    error instanceof ApiError ? (error.problem as ApiProblemV2) : null;
  const submit = async () => {
    if (!current.current || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const value = current.current;
      const contact = value.contact ?? profile.data?.contact ?? "";
      if (
        !value.pending &&
        (contact.trim().length < 5 || !value.sourceLanguage)
      ) {
        setInvalid(true);
        return;
      }
      const pending = value.pending ?? {
        key: `native-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        body: {
          contact,
          description: value.description,
          preferredDepartmentId: value.preferredDepartmentId,
          sourceLanguage: value.sourceLanguage,
        } as RegistrationRequestInputV2,
      };
      // Persist the exact command/key BEFORE transmission; restart retries the same command.
      await update({ pending });
      if (!alive.current) return;
      const result = await api<RegistrationRequestV2>(
        "/api/v2/requests",
        "POST",
        pending.body,
        pending.key,
      );
      if (!alive.current) return;
      await update({
        requestId: result.id,
        requestContract: "prd-v2",
        pending: null,
      });
      setOffset(0);
      rows.refresh();
    } catch (e) {
      if (!alive.current) return;
      if (
        e instanceof ApiError &&
        e.problem.status >= 400 &&
        e.problem.status < 500
      )
        await update({ pending: null }).catch(setError);
      setError(e);
    } finally {
      submitting.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const openExisting = () => {
    if (problem?.existingVisitId) onVisit(problem.existingVisitId);
    else if (problem?.existingRequestId) {
      edit({
        requestId: problem.existingRequestId,
        requestContract:
          problem.existingRequestContract === "legacy" ? "legacy" : "prd-v2",
      });
      setError(null);
    }
  };
  return (
    <>
      <Txt tone="title">{t("prepare")}</Txt>
      <LoadingState resource={profile} />
      <Feedback error={error} locale={locale} />
      {!draft && (
        <Btn
          secondary
          onPress={() => {
            void receptionStore
              .read(session.sessionId, locale)
              .then((value) => {
                current.current = value;
                setDraft(value);
                setError(null);
              })
              .catch(setError);
          }}
        >
          {t("retry")}
        </Btn>
      )}
      {draft && (
        <Card>
          <Txt tone="heading">{profile.data?.name}</Txt>
          {profile.data && profile.data.name.trim().length < 2 && (
            <>
              <Txt>{t("completeProfile")}</Txt>
              <Btn onPress={() => onProfile?.()}>{t("profile")}</Btn>
            </>
          )}
          <Input
            label={t("contact")}
            value={draft.contact ?? profile.data?.contact ?? ""}
            maxLength={80}
            editable={!busy && !draft.pending}
            onChangeText={(contact) => edit({ contact })}
          />
          {invalid && <Txt>{t("validation")}</Txt>}
          <Txt tone="heading">{t("preferredDepartment")}</Txt>
          <Choice
            label={t("noPreference")}
            disabled={busy || !!draft.pending}
            selected={!draft.preferredDepartmentId}
            onPress={() => {
              if (!busy && !draft.pending)
                edit({ preferredDepartmentId: null });
            }}
          />
          {config.departments
            .filter((d) => d.active)
            .map((d) => (
              <Choice
                key={d.id}
                disabled={busy || !!draft.pending}
                label={d.name ?? d.nameVi}
                selected={draft.preferredDepartmentId === d.id}
                onPress={() => {
                  if (!busy && !draft.pending)
                    edit({ preferredDepartmentId: d.id });
                }}
              />
            ))}
          <Txt tone="heading">{t("descriptionLanguage")}</Txt>
          {languages
            .filter((l) => ["vi", "en", "zh", "ja"].includes(l.code))
            .map((l) => (
              <Choice
                key={l.code}
                disabled={busy || !!draft.pending}
                label={l.label}
                selected={draft.sourceLanguage === l.code}
                onPress={() => {
                  if (!busy && !draft.pending)
                    edit({
                      sourceLanguage:
                        l.code as RegistrationRequestInputV2["sourceLanguage"],
                    });
                }}
              />
            ))}
          <Input
            label={t("description")}
            value={draft.description}
            multiline
            maxLength={2000}
            editable={!busy && !draft.pending}
            onChangeText={(description) => edit({ description })}
          />
          {draft.pending && !busy && <Txt>{t("connection")}</Txt>}
          {(problem?.existingRequestId || problem?.existingVisitId) && (
            <Btn secondary onPress={openExisting}>
              {t(problem.existingVisitId ? "continueVisit" : "continueRequest")}
            </Btn>
          )}
          <Btn
            busy={busy}
            disabled={
              !profile.data ||
              profile.data.name.trim().length < 2 ||
              !draft.sourceLanguage
            }
            onPress={() => void submit()}
          >
            {t(draft.pending ? "retry" : "sendRequest")}
          </Btn>
        </Card>
      )}
      <Card>
        <Txt tone="heading">{t("requestList")}</Txt>
        <LoadingState resource={rows} />
        {rows.data?.length === 0 && <Txt>{t("noRequests")}</Txt>}
        {rows.data?.map((r) => (
          <Choice
            key={r.id}
            label={`${r.patientName} · ${t(r.status)} · ${dateText(r.createdAt, locale)}`}
            selected={draft?.requestId === r.id}
            onPress={() => edit({ requestId: r.id, requestContract: "prd-v2" })}
          />
        ))}
        <Btn
          secondary
          disabled={offset === 0 || rows.loading}
          onPress={() => setOffset(Math.max(0, offset - 100))}
        >
          {t("previousPage")}
        </Btn>
        <Btn
          secondary
          disabled={rows.data?.length !== 100 || rows.loading}
          onPress={() => setOffset(offset + 100)}
        >
          {t("nextPage")}
        </Btn>
        <LoadingState resource={detail} />
        {detail.data && (
          <>
            <Badge value={detail.data.status} />
            <Txt>
              {detail.data.contact} · {detail.data.sourceLanguage}
            </Txt>
            <Txt>{detail.data.description}</Txt>
            {detail.data.visitId ? (
              <Btn onPress={() => onVisit(detail.data!.visitId!)}>
                {t("continueVisit")}
              </Btn>
            ) : (
              detail.data.status === "Submitted" && (
                <Txt>{t("receptionAwaitingConfirmation")}</Txt>
              )
            )}
          </>
        )}
      </Card>
      <Btn
        secondary
        onPress={() => {
          setHistory((v) => !v);
          setLegacyOffset(0);
        }}
      >
        {t("legacyRecords")}
      </Btn>
      {history && (
        <>
          <LoadingState resource={oldRows} />
          {oldRows.data
            ?.filter((r) => !r.sourceLanguage)
            .map((r) => (
              <Choice
                key={r.id}
                label={`${r.name} · ${t(r.status)}`}
                selected={draft?.requestId === r.id}
                onPress={() =>
                  edit({ requestId: r.id, requestContract: "legacy" })
                }
              />
            ))}
          <Btn
            secondary
            disabled={legacyOffset === 0 || oldRows.loading}
            onPress={() => setLegacyOffset(Math.max(0, legacyOffset - 100))}
          >
            {t("previousPage")}
          </Btn>
          <Btn
            secondary
            disabled={oldRows.data?.length !== 100 || oldRows.loading}
            onPress={() => setLegacyOffset(legacyOffset + 100)}
          >
            {t("nextPage")}
          </Btn>
        </>
      )}
      <LoadingState resource={oldDetail} />
      {oldDetail.data && (
        <Card>
          <Badge value={oldDetail.data.status} />
          <Txt>
            {oldDetail.data.name} · {oldDetail.data.contact}
          </Txt>
          <Txt>{oldDetail.data.description}</Txt>
          <Txt>{oldDetail.data.requests}</Txt>
          {oldDetail.data.messages.map((m) => (
            <Txt key={m.id}>
              {m.text}
              {m.response ? `\n${m.response}` : ""}
            </Txt>
          ))}
          {oldDetail.data.visitId && (
            <Btn onPress={() => onVisit(oldDetail.data!.visitId!)}>
              {t("continueVisit")}
            </Btn>
          )}
        </Card>
      )}
    </>
  );
}
