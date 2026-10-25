import { localizeText } from "@hospital/shared";
import { useState } from "react";
import {
  directoryCopy,
  directoryResults,
  displayName,
  floorLabel,
  type Directory,
} from "@hospital/shared";
import {
  Button,
  Field,
  Notice,
  ResourceState,
  SectionTitle,
} from "./components";
import { useResource, useRuntime } from "./runtime";
import "./directory.css";
export default function HospitalDirectory() {
  const { locale } = useRuntime();
  const resource = useResource<Directory>("/api/directory", true);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [limit, setLimit] = useState(24);
  const copy = directoryCopy[locale];
  const data = resource.data;
  const chosen = data?.departments.find((d) => d.id === department);
  const results = data
    ? directoryResults(data, query, department, specialty)
    : [];
  const reset = () => setLimit(24);
  return (
    <>
      <SectionTitle title={copy.title} />
      <p className="page-intro">{copy.source}</p>
      <ResourceState resource={resource} />
      {data && (
        <>
          <section className="panel directory-filters">
            <Field label={copy.search}>
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  reset();
                }}
              />
            </Field>
            <div className="form-grid">
              <Field label={copy.chooseDepartment}>
                <select
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setSpecialty("");
                    reset();
                  }}
                >
                  <option value="">{copy.all}</option>
                  {data.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {displayName(d, locale)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={copy.specialty}>
                <select
                  value={specialty}
                  onChange={(e) => {
                    setSpecialty(e.target.value);
                    reset();
                  }}
                >
                  <option value="">{copy.allSpecialties}</option>
                  {data.specialties
                    .filter((s) => !department || s.departmentId === department)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {!department
                          ? " · " +
                            data.departments.find(
                              (d) => d.id === s.departmentId,
                            )?.nameVi
                          : ""}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            {chosen && (
              <p data-testid="directory-department-location">
                <strong>{displayName(chosen, locale)}</strong> ·{" "}
                {chosen.locationConfirmed
                  ? localizeText("Khu ", locale) +
                    chosen.building +
                    " · " +
                    chosen.floors.map((f) => floorLabel(f, locale)).join(", ")
                  : copy.noLocation}
              </p>
            )}
          </section>
          <p role="status">
            {results.length} {copy.results}
          </p>
          {results.length === 0 && <Notice>{copy.noDoctors}</Notice>}
          <div className="directory-grid">
            {results.slice(0, limit).map((d) => {
              const dep = data.departments.find((x) => x.id === d.departmentId);
              const clinics = data.clinics.filter((c) =>
                d.clinicIds.includes(c.id),
              );
              const flagged = data.warnings.some((w) =>
                w.doctorIds.includes(d.id),
              );
              return (
                <article className="panel directory-card" key={d.id}>
                  <small>{d.isDoctor ? copy.doctor : copy.clinician}</small>
                  <h3>{d.name}</h3>
                  <p>{dep && displayName(dep, locale)}</p>
                  <p className="directory-specialties">
                    {data.specialties
                      .filter((s) => d.specialtyIds.includes(s.id))
                      .map((s) => s.name)
                      .join(" · ")}
                  </p>
                  <ul>
                    {clinics.map((c) => (
                      <li key={c.id}>
                        {c.room ? copy.room + " " + c.room + " · " : ""}
                        {c.name}
                        <small>
                          {c.locationConfirmed
                            ? c.building + " · " + floorLabel(c.floor, locale)
                            : copy.unknown}
                        </small>
                      </li>
                    ))}
                  </ul>
                  {flagged && <p className="directory-review">{copy.review}</p>}
                  <details>
                    <summary>{copy.provenance}</summary>
                    <ul>
                      {d.sourceVariants.map((v, i) => (
                        <li key={i}>
                          {v.text} — {v.sheet}!{v.cell}
                        </li>
                      ))}
                    </ul>
                  </details>
                </article>
              );
            })}
          </div>
          {results.length > limit && (
            <Button variant="secondary" onClick={() => setLimit((n) => n + 24)}>
              {copy.more}
            </Button>
          )}
          <details className="panel directory-notes">
            <summary>{copy.notes}</summary>
            <ul>
              {data.warnings.map((w, i) => (
                <li key={i}>{w.detail}</li>
              ))}
            </ul>
          </details>
        </>
      )}
    </>
  );
}
