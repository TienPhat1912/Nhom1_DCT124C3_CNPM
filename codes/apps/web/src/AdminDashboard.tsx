import { useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  HeartPulse,
  LifeBuoy,
  RefreshCw,
  Stethoscope,
  Users,
} from "lucide-react";
import {
  displayName,
  type AdminConfig,
  type AdminDashboardData,
} from "@hospital/shared";
import { Button, Empty, Field, ResourceState } from "./components";
import { useResource, useRuntime } from "./runtime";
import "./admin-dashboard.css";

export default function AdminDashboard({
  onConfigure,
}: {
  onConfigure: (tab: keyof AdminConfig) => void;
}) {
  const { t, locale } = useRuntime();
  const [days, setDays] = useState(7);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const resource = useResource<AdminDashboardData>(
    `/api/admin/dashboard?days=${days}`,
    true,
  );
  const data = resource.data;
  const number = (value: number) =>
    value.toLocaleString(locale === "vi" ? "vi-VN" : "en-US");
  const formatDate = (date: string) =>
    new Date(`${date}T00:00:00+07:00`).toLocaleDateString(
      locale === "vi" ? "vi-VN" : "en-GB",
      { day: "2-digit", month: "2-digit", timeZone: "Asia/Ho_Chi_Minh" },
    );
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d");
  const departments =
    data?.departments.filter((d) =>
      normalize(`${d.nameVi} ${d.nameEn}`).includes(normalize(search.trim())),
    ) ?? [];
  const selected =
    data?.daily.find((d) => d.date === selectedDate) ?? data?.daily.at(-1);
  const chartMax = Math.max(
    1,
    ...(data?.daily.flatMap((d) => [d.admitted, d.closed]) ?? []),
  );
  const admitted =
    data?.daily.reduce((total, day) => total + day.admitted, 0) ?? 0;
  const closed = data?.daily.reduce((total, day) => total + day.closed, 0) ?? 0;

  return (
    <section className="admin-dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-heading">
        <div>
          <h2 id="dashboard-title">{t("dashboardTitle")}</h2>
          <p>{t("dashboardIntro")}</p>
        </div>
        <Button
          variant="secondary"
          onClick={resource.refresh}
          disabled={resource.loading}
        >
          <RefreshCw
            size={16}
            className={resource.loading ? "spin" : ""}
            aria-hidden="true"
          />
          {t("refresh")}
        </Button>
      </div>
      <div className="dashboard-update">
        <span>{t("dashboardAutoRefresh")}</span>
        {data && (
          <time dateTime={data.generatedAt}>
            {t("dashboardUpdated")}{" "}
            {new Date(data.generatedAt).toLocaleTimeString(
              locale === "vi" ? "vi-VN" : "en-GB",
              { timeZone: data.timeZone },
            )}
          </time>
        )}
      </div>
      <ResourceState resource={resource} />
      {data && (
        <>
          <div className="dashboard-metrics">
            {[
              {
                key: "visitsToday",
                label: "dashboardVisitsToday",
                value: data.summary.visitsToday,
                hint: `${number(data.summary.closedToday)} ${t("dashboardClosedToday")}`,
                Icon: HeartPulse,
                tone: "green",
              },
              {
                key: "activeVisits",
                label: "dashboardActiveVisits",
                value: data.summary.activeVisits,
                hint: t("dashboardActiveHint"),
                Icon: Activity,
                tone: "blue",
              },
              {
                key: "pendingRequests",
                label: "dashboardPendingRequests",
                value: data.summary.pendingRequests,
                hint: t("dashboardPendingHint"),
                Icon: ClipboardList,
                tone: "amber",
              },
              {
                key: "openAssistance",
                label: "dashboardOpenAssistance",
                value: data.summary.openAssistance,
                hint: t("dashboardAssistanceHint"),
                Icon: LifeBuoy,
                tone: "rose",
              },
            ].map(({ key, label, value, hint, Icon, tone }) => (
              <article
                className={`dashboard-metric metric-${tone}`}
                key={key}
                aria-label={t(label)}
              >
                <div className="metric-top">
                  <span>{t(label)}</span>
                  <span className="metric-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                </div>
                <strong data-testid={`metric-${key}`}>{number(value)}</strong>
                <p>{hint}</p>
              </article>
            ))}
          </div>

          <div className="dashboard-columns">
            <section
              className="panel dashboard-trend"
              aria-labelledby="dashboard-trend-title"
            >
              <div className="dashboard-panel-heading">
                <h3 id="dashboard-trend-title">{t("dashboardTrend")}</h3>
                <Field label={t("dashboardPeriod")}>
                  <select
                    value={days}
                    onChange={(event) => {
                      setDays(Number(event.target.value));
                      setSelectedDate(null);
                    }}
                  >
                    <option value={7}>{t("dashboardLast7")}</option>
                    <option value={30}>{t("dashboardLast30")}</option>
                  </select>
                </Field>
              </div>
              <div className="dashboard-chart-totals">
                <div>
                  <span className="chart-key admitted" />
                  {t("dashboardAdmitted")} <strong>{number(admitted)}</strong>
                </div>
                <div>
                  <span className="chart-key closed" />
                  {t("dashboardClosed")} <strong>{number(closed)}</strong>
                </div>
              </div>
              {admitted + closed === 0 && (
                <p className="dashboard-no-visits">{t("dashboardNoVisits")}</p>
              )}
              <div
                className="dashboard-chart-scroll"
                role="group"
                aria-label={t("dashboardTrend")}
              >
                <div
                  className={`dashboard-chart ${days === 30 ? "chart-month" : ""}`}
                >
                  {data.daily.map((day) => {
                    const label = `${formatDate(day.date)}: ${t("dashboardAdmitted")} ${number(day.admitted)}, ${t("dashboardClosed")} ${number(day.closed)}`;
                    return (
                      <button
                        type="button"
                        className="dashboard-chart-day"
                        key={day.date}
                        aria-label={label}
                        aria-pressed={selected?.date === day.date}
                        title={label}
                        onClick={() => setSelectedDate(day.date)}
                      >
                        <span className="dashboard-bars" aria-hidden="true">
                          <span
                            className="chart-bar admitted"
                            style={{
                              height: `${(day.admitted / chartMax) * 100}%`,
                            }}
                          />
                          <span
                            className="chart-bar closed"
                            style={{
                              height: `${(day.closed / chartMax) * 100}%`,
                            }}
                          />
                        </span>
                        <span className="chart-date" aria-hidden="true">
                          {formatDate(day.date)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {selected && (
                <div
                  className="dashboard-chart-detail"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <strong>{formatDate(selected.date)}</strong>
                  <span>
                    {t("dashboardAdmitted")}: <b>{number(selected.admitted)}</b>
                  </span>
                  <span>
                    {t("dashboardClosed")}: <b>{number(selected.closed)}</b>
                  </span>
                </div>
              )}
              <p className="dashboard-caption">{t("dashboardTrendHint")}</p>
            </section>

            <section
              className="panel dashboard-setup"
              aria-labelledby="dashboard-setup-title"
            >
              <h3 id="dashboard-setup-title">{t("dashboardSetup")}</h3>
              <p className="dashboard-caption">{t("dashboardSetupHint")}</p>
              {[
                {
                  tab: "departments" as const,
                  label: "dashboardActiveDepartments",
                  value: data.configuration.activeDepartments,
                  Icon: Building2,
                },
                {
                  tab: "staff" as const,
                  label: "dashboardActiveStaff",
                  value: data.configuration.activeStaff,
                  Icon: Users,
                },
                {
                  tab: "services" as const,
                  label: "dashboardActiveServices",
                  value: data.configuration.activeServices,
                  Icon: Stethoscope,
                },
              ].map(({ tab, label, value, Icon }) => (
                <button
                  type="button"
                  className="dashboard-shortcut"
                  key={tab}
                  onClick={() => onConfigure(tab)}
                >
                  <span className="shortcut-icon">
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span>
                    {t(label)}
                    <strong>{number(value)}</strong>
                  </span>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </button>
              ))}
              {data.configuration.servicesWithoutMapping > 0 ? (
                <div className="dashboard-mapping-warning">
                  <p>
                    {t("dashboardMappingWarning")}:{" "}
                    <strong>
                      {number(data.configuration.servicesWithoutMapping)}
                    </strong>
                  </p>
                  <Button
                    variant="quiet"
                    onClick={() => onConfigure("mappings")}
                  >
                    {t("dashboardMappingAction")}{" "}
                    <ArrowUpRight size={15} aria-hidden="true" />
                  </Button>
                </div>
              ) : (
                data.configuration.activeServices > 0 && (
                  <p className="dashboard-mapping-ready">
                    <CheckCircle2 size={18} aria-hidden="true" />
                    {t("dashboardMappingReady")}
                  </p>
                )
              )}
            </section>
          </div>

          <section
            className="panel dashboard-departments"
            aria-labelledby="dashboard-departments-title"
          >
            <div className="dashboard-panel-heading">
              <div>
                <h3 id="dashboard-departments-title">
                  {t("dashboardDepartments")}
                </h3>
                <p className="dashboard-caption">
                  {t("dashboardDepartmentHint")}
                </p>
              </div>
              <Field label={t("dashboardFindDepartment")}>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("dashboardFindDepartment")}
                />
              </Field>
            </div>
            {departments.length === 0 ? (
              <Empty text={t("dashboardNoDepartments")} />
            ) : (
              <div
                className="dashboard-table-scroll"
                tabIndex={0}
                role="region"
                aria-label={t("dashboardDepartments")}
              >
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th scope="col">{t("department")}</th>
                      <th scope="col">{t("dashboardActiveVisits")}</th>
                      <th scope="col">{t("dashboardWaitingSteps")}</th>
                      <th scope="col">{t("dashboardInProgressSteps")}</th>
                      <th scope="col">{t("dashboardOpenAssistance")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((department) => (
                      <tr key={department.id}>
                        <th scope="row">
                          {displayName(department, locale)}
                          {!department.active && (
                            <small>{t("dashboardInactive")}</small>
                          )}
                        </th>
                        <td>
                          <span className="dashboard-count">
                            {number(department.activeVisits)}
                          </span>
                        </td>
                        <td>{number(department.waitingSteps)}</td>
                        <td>{number(department.inProgressSteps)}</td>
                        <td>
                          <span
                            className={
                              department.openAssistance
                                ? "dashboard-count count-attention"
                                : ""
                            }
                          >
                            {number(department.openAssistance)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
