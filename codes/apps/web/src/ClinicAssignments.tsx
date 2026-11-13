import { useState } from "react";
import {
  displayName,
  type AdminClinicAssignment,
  type AdminConfig,
} from "@hospital/shared";
import {
  Button,
  Empty,
  Feedback,
  Field,
  Form,
  Notice,
  ResourceState,
} from "./components";
import { useMutation, useResource, useRuntime } from "./runtime";

export default function ClinicAssignments({ config }: { config: AdminConfig }) {
  const { t, locale } = useRuntime();
  const resource = useResource<AdminClinicAssignment[]>(
    "/api/v2/admin/clinics",
  );
  const [id, setId] = useState("");
  const [search, setSearch] = useState("");
  const selected = resource.data?.find((room) => room.clinicLocationId === id);
  return (
    <>
      <ResourceState resource={resource} />
      <div className="split-layout">
        <aside className="panel">
          <Field label={t("findClinic")}>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          {resource.data
            ?.filter((room) =>
              `${room.nameVi} ${room.room}`
                .toLocaleLowerCase()
                .includes(search.toLocaleLowerCase()),
            )
            .map((room) => (
              <button
                className={`record-row ${id === room.clinicLocationId ? "selected" : ""}`}
                key={room.clinicLocationId}
                onClick={() => setId(room.clinicLocationId)}
              >
                <span>
                  <strong>{displayName(room, locale)}</strong>
                  <small>
                    {room.room} ·{" "}
                    {room.activeDoctor?.name ?? t("noActiveDoctor")}
                  </small>
                </span>
              </button>
            ))}
          {resource.data?.length === 0 && <Empty text={t("empty")} />}
        </aside>
        <div className="panel">
          {selected ? (
            <AssignmentEditor
              key={`${id}:${selected.version}:${selected.activeVisitCount}:${selected.activeDoctorUsable}`}
              room={selected}
              rooms={resource.data!}
              config={config}
              refresh={resource.refresh}
            />
          ) : (
            <Empty text={t("noSelection")} />
          )}
        </div>
      </div>
    </>
  );
}

function AssignmentEditor({
  room,
  rooms,
  config,
  refresh,
}: {
  room: AdminClinicAssignment;
  rooms: AdminClinicAssignment[];
  config: AdminConfig;
  refresh: () => void;
}) {
  const { t, locale } = useRuntime();
  const mutation = useMutation();
  const [doctorIds, setDoctorIds] = useState(room.doctorIds);
  const [activeId, setActiveId] = useState(room.activeDoctor?.id ?? "");
  const [review, setReview] = useState<"members" | "active" | null>(null);
  const candidates = config.staff
    .filter(
      (doctor) =>
        room.doctorIds.includes(doctor.id) ||
        (doctor.role === "Doctor" &&
          doctor.active &&
          !doctor.directoryOnly &&
          doctor.departmentIds.includes(room.departmentId) &&
          !rooms.some(
            (other) =>
              other.clinicLocationId !== room.clinicLocationId &&
              other.doctorIds.includes(doctor.id),
          )),
    )
    .sort((first, second) => first.name.localeCompare(second.name, locale));
  const selectable = candidates.filter(
    (doctor) =>
      room.doctorIds.includes(doctor.id) &&
      doctor.role === "Doctor" &&
      doctor.active &&
      !doctor.directoryOnly &&
      doctor.departmentIds.includes(room.departmentId),
  );
  const membershipChanged =
    [...doctorIds].sort().join() !== [...room.doctorIds].sort().join();
  const save = async () => {
    const result = await mutation.run<AdminClinicAssignment>(
      `/api/v2/admin/clinics/${room.clinicLocationId}/${review === "members" ? "doctors" : "active-doctor"}`,
      review === "members"
        ? { version: room.version, doctorIds }
        : { version: room.version, doctorId: activeId || null },
      "PUT",
    );
    if (result) {
      setReview(null);
      refresh();
    }
  };
  return (
    <>
      <h3>
        {displayName(room, locale)} · {room.room}
      </h3>
      <dl className="detail-grid">
        <dt>{t("activeDoctor")}</dt>
        <dd>{room.activeDoctor?.name ?? t("noActiveDoctor")}</dd>
        <dt>{t("activeVisitCount")}</dt>
        <dd>{room.activeVisitCount}</dd>
      </dl>
      {!room.available && <Notice>{t("clinicUnavailable")}</Notice>}
      {room.activeDoctor && !room.activeDoctorUsable && (
        <Notice>{t("assignedDoctorUnavailable")}</Notice>
      )}
      {!room.canChangeDoctor && room.activeVisitCount > 0 && (
        <Notice>{t("clinicHasActiveVisits")}</Notice>
      )}
      <Button variant="secondary" onClick={refresh} disabled={mutation.busy}>
        {t("refresh")}
      </Button>
      <Feedback error={mutation.error} ok={mutation.ok} locale={locale} />
      {review ? (
        <Form busy={mutation.busy} onSubmit={save}>
          <h4>{t("review")}</h4>
          <p>{review === "members" ? t("clinicMembers") : t("activeDoctor")}</p>
          <p>
            {review === "members"
              ? candidates
                  .filter((d) => doctorIds.includes(d.id))
                  .map((d) => d.name)
                  .join(" · ") || t("empty")
              : (candidates.find((d) => d.id === activeId)?.name ??
                t("noActiveDoctor"))}
          </p>
          <Button
            type="submit"
            busy={mutation.busy}
            disabled={!room.canChangeDoctor}
          >
            {t("confirmAssignment")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setReview(null)}
          >
            {t("cancel")}
          </Button>
        </Form>
      ) : (
        <>
          <Form
            busy={mutation.busy}
            onSubmit={() => {
              mutation.clear();
              setReview("members");
            }}
          >
            <h4>{t("clinicMembers")}</h4>
            <Notice>{t("clinicMembershipHint")}</Notice>
            {candidates.length === 0 && <Empty text={t("noEligibleDoctors")} />}
            {candidates.map((doctor) => (
              <label className="check-field" key={doctor.id}>
                <input
                  type="checkbox"
                  checked={doctorIds.includes(doctor.id)}
                  disabled={
                    !room.canChangeDoctor || doctor.id === room.activeDoctor?.id
                  }
                  onChange={(e) =>
                    setDoctorIds((ids) =>
                      e.target.checked
                        ? [...ids, doctor.id]
                        : ids.filter((id) => id !== doctor.id),
                    )
                  }
                />
                {doctor.name}
              </label>
            ))}
            <Button
              type="submit"
              disabled={!room.canChangeDoctor || !membershipChanged}
            >
              {t("reviewMembers")}
            </Button>
          </Form>
          <Form
            busy={mutation.busy}
            onSubmit={() => {
              mutation.clear();
              setReview("active");
            }}
          >
            <Field label={t("activeDoctor")}>
              <select
                value={activeId}
                disabled={!room.canChangeDoctor}
                onChange={(e) => setActiveId(e.target.value)}
              >
                <option value="">{t("noActiveDoctor")}</option>
                {room.activeDoctor &&
                  !selectable.some((d) => d.id === room.activeDoctor?.id) && (
                    <option value={room.activeDoctor.id} disabled>
                      {room.activeDoctor.name}
                    </option>
                  )}
                {selectable.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              type="submit"
              disabled={
                !room.canChangeDoctor ||
                activeId === (room.activeDoctor?.id ?? "")
              }
            >
              {t("reviewActiveDoctor")}
            </Button>
          </Form>
        </>
      )}
    </>
  );
}
