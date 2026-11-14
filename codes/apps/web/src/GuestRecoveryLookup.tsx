import { useState } from "react";
import { dateText, displayName, type GuestTicketMatch } from "@hospital/shared";
import {
  Button,
  Empty,
  Field,
  Form,
  Notice,
  ResourceState,
  SectionTitle,
} from "./components";
import { useResource, useRuntime } from "./runtime";
import { RecoveryActions } from "./RecoveryActions";

export function GuestRecoveryLookup() {
  const { t, config, locale } = useRuntime();
  const [number, setNumber] = useState("");
  const [date, setDate] = useState("");
  const [clinic, setClinic] = useState("");
  const [query, setQuery] = useState<string | null>(null);
  const [selected, setSelected] = useState<GuestTicketMatch | null>(null);
  const results = useResource<{ items: GuestTicketMatch[]; hasMore: boolean }>(
    query,
  );
  const clear = () => {
    setQuery(null);
    setSelected(null);
  };
  return (
    <details className="panel">
      <summary>{t("guestTicketLookup")}</summary>
      <Form
        busy={results.loading}
        onSubmit={() => {
          setSelected(null);
          setQuery(
            `/api/reception/guest-tickets?number=${Number(number)}&issuedOn=${date}${clinic ? `&clinicLocationId=${clinic}` : ""}`,
          );
          results.refresh();
        }}
      >
        <Field label={t("ticketNumber")}>
          <input
            required
            type="number"
            min="1"
            max="2147483647"
            value={number}
            onChange={(e) => {
              clear();
              setNumber(e.target.value);
            }}
          />
        </Field>
        <Field label={t("ticketDate")}>
          <input
            required
            type="date"
            value={date}
            onChange={(e) => {
              clear();
              setDate(e.target.value);
            }}
          />
        </Field>
        <Field label={t("location")}>
          <select
            value={clinic}
            onChange={(e) => {
              clear();
              setClinic(e.target.value);
            }}
          >
            <option value="">—</option>
            {config.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {displayName(l, locale)} · {l.room}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit">{t("searchTickets")}</Button>
      </Form>
      {query && <ResourceState resource={results} />}
      {results.data?.items.length === 0 && <Empty text={t("noSelection")} />}
      {results.data?.hasMore && <Notice>{t("narrowTicketSearch")}</Notice>}
      {results.data?.items.map((item) => (
        <button
          className="record-row"
          key={item.visitId}
          onClick={() => setSelected(item)}
        >
          {item.number} · {item.issuedOn} · {item.clinic?.nameVi} ·{" "}
          {item.clinic?.room} · {item.patient?.name}
        </button>
      ))}
      {selected && (
        <section key={selected.visitId}>
          <SectionTitle title={selected.patient?.name ?? "—"} />
          <p>
            {selected.patient?.contact} · {selected.clinic?.nameVi} ·{" "}
            {selected.clinic?.room} · {dateText(selected.issuedOn, locale)} ·{" "}
            {selected.number}
          </p>
          <RecoveryActions id={selected.visitId} />
        </section>
      )}
    </details>
  );
}
