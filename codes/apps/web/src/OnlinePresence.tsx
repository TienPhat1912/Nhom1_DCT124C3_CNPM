import { dateText, type OnlinePresenceV2 } from "@hospital/shared";
import { Button, Notice } from "./components";
import { useResource, useRuntime } from "./runtime";

export function OnlinePresence() {
  const { t, locale } = useRuntime();
  const resource = useResource<OnlinePresenceV2>(
    "/api/v2/admin/presence",
    true,
    true,
  );
  const value = resource.data;
  const valid =
    value &&
    [value.accounts, value.guests, value.total].every(
      (n) => Number.isSafeInteger(n) && n >= 0,
    ) &&
    value.total === value.accounts + value.guests &&
    Number.isFinite(Date.parse(value.generatedAt));
  return (
    <section className="panel" aria-label={t("onlinePresence")}>
      <h3>{t("onlinePresence")}</h3>
      {valid && (
        <>
          <p>
            <strong data-testid="online-total">
              {value.total.toLocaleString(locale)}
            </strong>{" "}
            · {t("onlineAccounts")}:{" "}
            <span data-testid="online-accounts">
              {value.accounts.toLocaleString(locale)}
            </span>{" "}
            · {t("onlineGuests")}:{" "}
            <span data-testid="online-guests">
              {value.guests.toLocaleString(locale)}
            </span>
          </p>
          <p>
            {t("dashboardUpdated")}{" "}
            <time data-testid="online-updated" dateTime={value.generatedAt}>
              {dateText(value.generatedAt, locale)}
            </time>
          </p>
          {(!!resource.error || (resource.stale && !navigator.onLine)) && (
            <Notice>{t("onlineStale")}</Notice>
          )}
        </>
      )}
      {resource.loading && !valid && <p role="status">{t("loading")}</p>}
      {(!!resource.error || (!resource.loading && !valid)) && (
        <>
          {!valid && <Notice>{t("onlineUnavailable")}</Notice>}
          <Button onClick={resource.refresh}>{t("retry")}</Button>
        </>
      )}
    </section>
  );
}
