import { useState } from "react";
import { LayoutDashboard, Plus, Settings2 } from "lucide-react";
import {
  displayName,
  directoryText,
  type AdminConfig,
  type MappingNode,
} from "@hospital/shared";
import {
  Button,
  Empty,
  Feedback,
  Field,
  Form,
  Notice,
  ResourceState,
  SectionTitle,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";
import { HospitalQr } from "./HospitalEntry";
import AdminDashboard from "./AdminDashboard";
type Tab = keyof AdminConfig;
const tabs: Tab[] = [
  "departments",
  "locations",
  "services",
  "mappings",
  "templates",
  "routes",
  "staff",
];
type Values = Record<string, string | number | boolean | string[] | null>;
export default function Admin() {
  const { t, locale } = useRuntime();
  const [tab, setTab] = useState<Tab | "dashboard">("dashboard");
  const resource = useResource<AdminConfig>(
    tab === "dashboard" ? null : "/api/admin/configuration",
  );
  const [id, setId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const data = resource.data;
  const record =
    id && tab !== "dashboard"
      ? data?.[tab].find((r) => r.id === id)
      : undefined;
  const selectTab = (next: Tab | "dashboard") => {
    setTab(next);
    setSearch("");
    setId(null);
    setCreating(false);
  };
  return (
    <>
      <SectionTitle eyebrow={t("staffWorkspace")} title={t("adminWorkspace")}>
        <Settings2 />
      </SectionTitle>
      <nav className="tabs admin-tabs" aria-label={t("adminWorkspace")}>
        <button
          className={tab === "dashboard" ? "selected" : ""}
          aria-current={tab === "dashboard" ? "page" : undefined}
          onClick={() => selectTab("dashboard")}
        >
          <LayoutDashboard size={16} aria-hidden="true" /> {t("dashboard")}
        </button>
        {tabs.map((x) => (
          <button
            key={x}
            className={x === tab ? "selected" : ""}
            aria-current={x === tab ? "page" : undefined}
            onClick={() => selectTab(x)}
          >
            {t(x)}
          </button>
        ))}
      </nav>
      {tab === "dashboard" ? (
        <AdminDashboard onConfigure={selectTab} />
      ) : (
        <ResourceState resource={resource} />
      )}
      {data && tab !== "dashboard" && (
        <div className="split-layout">
          <aside className="panel">
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(true);
                setId(null);
              }}
            >
              <Plus size={16} />
              {t("create")}
            </Button>
            <Field
              label={
                locale === "vi" ? "Tìm trong danh mục" : "Search configuration"
              }
            >
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            {data[tab]
              .filter((record) =>
                directoryText(
                  JSON.stringify(record) +
                    ("departmentIds" in record
                      ? record.departmentIds
                          .map(
                            (id) =>
                              data.departments.find((d) => d.id === id)
                                ?.nameVi ?? "",
                          )
                          .join(" ")
                      : ""),
                ).includes(directoryText(search)),
              )
              .map((record) => {
                const item = record as unknown as Values;
                const name =
                  typeof item.nameVi === "string"
                    ? locale === "vi"
                      ? item.nameVi
                      : item.nameEn
                    : (item.name ??
                      item.key ??
                      (item.hospitalServiceId
                        ? displayName(
                            data.services.find(
                              (s) => s.id === item.hospitalServiceId,
                            ) ?? { nameVi: t("service"), nameEn: t("service") },
                            locale,
                          )
                        : t("routes")));
                return (
                  <button
                    className={`record-row ${record.id === id ? "selected" : ""}`}
                    key={record.id}
                    onClick={() => {
                      setId(record.id);
                      setCreating(false);
                    }}
                  >
                    <span>
                      <strong>{String(name)}</strong>
                      <small>
                        {String(item.code ?? item.language ?? "")}{" "}
                        {item.revision
                          ? `· ${t("revision")} ${item.revision}`
                          : ""}
                      </small>
                    </span>
                    <span>{t("edit")}</span>
                  </button>
                );
              })}
          </aside>
          <div className="panel">
            {record || creating ? (
              <ConfigEditor
                key={`${tab}:${id}:${record?.version}`}
                tab={tab}
                data={data}
                record={record as unknown as Values | undefined}
                onSaved={() => {
                  resource.refresh();
                  setCreating(false);
                  setId(null);
                }}
              />
            ) : (
              <Empty text={t("noSelection")} />
            )}
          </div>
        </div>
      )}
      <HospitalQr locale={locale} />
    </>
  );
}
function ConfigEditor({
  tab,
  data,
  record,
  onSaved,
}: {
  tab: Tab;
  data: AdminConfig;
  record?: Values;
  onSaved: () => void;
}) {
  const { t, locale } = useRuntime();
  const mutation = useMutation();
  const [values, setValues] = useState<Values>({
    id: null,
    version: 0,
    active: true,
    publish: false,
    role: "Reception",
    departmentIds: [],
    category: "Guidance",
    language: "vi",
    returnRequired: true,
    departmentId: data.departments.find((d) => d.active)?.id ?? "",
    locationId: data.locations.find((l) => l.active)?.id ?? "",
    serviceId: data.services.find((s) => s.active)?.id ?? "",
    ...record,
  });
  const [nodes, setNodes] = useState<MappingNode[]>(() => {
    if (tab === "mappings" && record?.stepsJson) {
      try {
        return JSON.parse(String(record.stepsJson)) as MappingNode[];
      } catch {
        return [];
      }
    }
    return [
      {
        key: "service",
        locationId: data.locations[0]?.id ?? "",
        templateKey: "laboratory",
        authority: "Service",
        dependsOn: [],
      },
    ];
  });
  const get = (key: string) => String(values[key] ?? "");
  const put = (key: string, value: string | boolean | string[]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const text = (
    key: string,
    label = key,
    required = true,
    multiline = false,
  ) => (
    <Field key={key} label={t(label)}>
      {multiline ? (
        <textarea
          value={get(key)}
          required={required}
          maxLength={4000}
          onChange={(e) => put(key, e.target.value)}
          rows={4}
        />
      ) : (
        <input
          value={get(key)}
          type={
            key.toLowerCase().includes("password")
              ? "password"
              : key === "email"
                ? "email"
                : "text"
          }
          required={required}
          maxLength={key === "password" ? 128 : 120}
          onChange={(e) => put(key, e.target.value)}
        />
      )}
    </Field>
  );
  const select = (
    key: string,
    label: string,
    options: { id: string; label: string }[],
  ) => (
    <Field key={key} label={t(label)}>
      <select
        value={get(key)}
        required
        onChange={(e) => put(key, e.target.value)}
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
  const check = (key: string, label: string) => (
    <label className="check-field" key={key}>
      <input
        type="checkbox"
        checked={!!values[key]}
        onChange={(e) => put(key, e.target.checked)}
      />
      {t(label)}
    </label>
  );
  const depOptions = data.departments
    .filter((d) => d.active)
    .map((d) => ({ id: d.id, label: displayName(d, locale) }));
  const locOptions = data.locations
    .filter((l) => l.active)
    .map((l) => ({ id: l.id, label: `${displayName(l, locale)} · ${l.room}` }));
  return (
    <>
      <h3>
        {t(tab)} · {t(record ? "edit" : "create")}
      </h3>
      {(tab === "mappings" || tab === "templates") && (
        <Notice>{t("newCorrection")}</Notice>
      )}
      {tab === "staff" && record?.specialties && (
        <p>{(record.specialties as string[]).join(" · ")}</p>
      )}
      {tab === "staff" && record?.directoryOnly && (
        <Notice>
          {locale === "vi"
            ? "Hồ sơ từ Excel, chưa có đăng nhập. Chỉ cấp tài khoản khi đã xác minh nhân sự: cập nhật email thật và mật khẩu mới."
            : "Imported directory profile without login. Verify the staff member, then set a real email and new password to provision access."}
        </Notice>
      )}
      <Form
        busy={mutation.busy}
        onSubmit={async () => {
          let payload: unknown = values;
          if (tab === "mappings")
            payload = {
              serviceId: values.hospitalServiceId ?? values.serviceId,
              steps: nodes,
              publish: !!values.publish,
            };
          if (tab === "templates")
            payload = {
              key: values.key,
              language: values.language,
              text: values.text,
              category: values.category,
              publish: !!values.publish,
            };
          if (await mutation.run(`/api/admin/${tab}`, payload)) onSaved();
        }}
      >
        {(tab === "departments" || tab === "services") && text("code")}
        {["departments", "locations", "services"].includes(tab) && (
          <div className="form-grid">
            {text("nameVi")}
            {text("nameEn")}
          </div>
        )}
        {(tab === "locations" || tab === "services") &&
          select("departmentId", "department", depOptions)}
        {tab === "locations" && (
          <div className="form-grid">
            {text("building")}
            {text("floor")}
            {text("room")}
          </div>
        )}
        {tab === "services" && (
          <>
            {select("locationId", "location", locOptions)}
            {check("returnRequired", "returnRequired")}
          </>
        )}
        {["departments", "locations", "services", "routes", "staff"].includes(
          tab,
        ) && check("active", "enabled")}
        {tab === "templates" && (
          <>
            {text("key", "templateKey")}
            {select("language", "language", [
              { id: "vi", label: "Tiếng Việt" },
              { id: "en", label: "English" },
            ])}
            {select("category", "category", [
              { id: "Guidance", label: t("journey") },
              { id: "Reception", label: t("Reception") },
            ])}
            {text("text", "text", true, true)}
            {check("publish", "approved")}
          </>
        )}
        {tab === "routes" && (
          <>
            {select("fromLocationId", "from", locOptions)}
            {select("toLocationId", "to", locOptions)}
            {select("language", "language", [
              { id: "vi", label: "Tiếng Việt" },
              { id: "en", label: "English" },
            ])}
            {text("instructions", "instructions", true, true)}
          </>
        )}
        {tab === "staff" && (
          <>
            {text("email")}
            {text("name")}
            {select(
              "role",
              "role",
              ["Reception", "Doctor", "Service", "Cashier", "Admin"].map(
                (role) => ({ id: role, label: t(role) }),
              ),
            )}
            {text("password", record ? "newPassword" : "password", !record)}
            <h4>{t("scopes")}</h4>
            {depOptions.map((dep) => (
              <label className="check-field" key={dep.id}>
                <input
                  type="checkbox"
                  checked={((values.departmentIds as string[]) ?? []).includes(
                    dep.id,
                  )}
                  onChange={(e) =>
                    put(
                      "departmentIds",
                      e.target.checked
                        ? [
                            ...((values.departmentIds as string[]) ?? []),
                            dep.id,
                          ]
                        : ((values.departmentIds as string[]) ?? []).filter(
                            (d) => d !== dep.id,
                          ),
                    )
                  }
                />
                {dep.label}
              </label>
            ))}
          </>
        )}
        {tab === "mappings" && (
          <>
            {select(
              record ? "hospitalServiceId" : "serviceId",
              "service",
              data.services
                .filter((s) => s.active)
                .map((s) => ({ id: s.id, label: displayName(s, locale) })),
            )}
            <h4>{t("mappingSteps")}</h4>
            {nodes.map((node, i) => {
              const update = (patch: Partial<MappingNode>) =>
                setNodes((ns) =>
                  ns.map((n, j) => (i === j ? { ...n, ...patch } : n)),
                );
              return (
                <div className="sub-panel" key={i}>
                  <Field label={t("stepKey")}>
                    <input
                      required
                      value={node.key}
                      onChange={(e) => update({ key: e.target.value })}
                    />
                  </Field>
                  <Field label={t("location")}>
                    <select
                      value={node.locationId}
                      onChange={(e) => update({ locationId: e.target.value })}
                    >
                      {locOptions.map((l) => (
                        <option value={l.id} key={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("templateKey")}>
                    <select
                      value={node.templateKey}
                      onChange={(e) => update({ templateKey: e.target.value })}
                    >
                      {[
                        ...new Set(
                          data.templates
                            .filter(
                              (t) => t.published && t.category === "Guidance",
                            )
                            .map((t) => t.key),
                        ),
                      ].map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={t("authority")}>
                    <select
                      value={node.authority}
                      onChange={(e) => update({ authority: e.target.value })}
                    >
                      <option value="Service">{t("Service")}</option>
                      <option value="Cashier">{t("Cashier")}</option>
                    </select>
                  </Field>
                  <Field label={t("dependsOn")}>
                    <input
                      value={node.dependsOn.join(",")}
                      onChange={(e) =>
                        update({
                          dependsOn: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </Field>
                  <Button
                    variant="danger"
                    type="button"
                    disabled={nodes.length === 1}
                    onClick={() =>
                      setNodes((ns) => ns.filter((_, j) => j !== i))
                    }
                  >
                    {t("cancel")}
                  </Button>
                </div>
              );
            })}
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setNodes((ns) => [
                  ...ns,
                  {
                    key: `step${ns.length + 1}`,
                    locationId: data.locations[0]?.id ?? "",
                    templateKey: "laboratory",
                    authority: "Service",
                    dependsOn: ns.length ? [ns[ns.length - 1].key] : [],
                  },
                ])
              }
            >
              {t("addMappingStep")}
            </Button>
            {check("publish", "approved")}
          </>
        )}
        <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
        <Button type="submit" busy={mutation.busy}>
          {t("publishConfig")}
        </Button>
      </Form>
    </>
  );
}
