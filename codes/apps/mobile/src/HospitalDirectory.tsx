import { useState } from "react";
import {
  directoryCopy,
  directoryResults,
  directoryText,
  displayName,
  floorLabel,
  type Directory,
} from "@hospital/shared";
import { useLoad, useNative } from "./runtime";
import { Btn, Card, Choice, Input, LoadingState, Txt } from "./ui";
export function HospitalDirectory() {
  const { locale } = useNative();
  const resource = useLoad<Directory>("/api/directory", true);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [departmentsOpen, setDepartmentsOpen] = useState(false);
  const [departmentQuery, setDepartmentQuery] = useState("");
  const [limit, setLimit] = useState(12);
  const copy = directoryCopy[locale];
  const data = resource.data;
  const chosen = data?.departments.find((d) => d.id === department);
  const results = data
    ? directoryResults(data, query, department, specialty)
    : [];
  return (
    <>
      <Txt tone="title">{copy.title}</Txt>
      <Txt tone="muted">{copy.source}</Txt>
      <LoadingState resource={resource} />
      {data && (
        <>
          <Card>
            <Input
              label={copy.search}
              value={query}
              onChangeText={(v) => {
                setQuery(v);
                setLimit(12);
              }}
            />
            <Btn secondary onPress={() => setDepartmentsOpen(!departmentsOpen)}>
              {chosen ? displayName(chosen, locale) : copy.chooseDepartment}
            </Btn>
            {departmentsOpen && (
              <>
                <Input
                  label={copy.chooseDepartment}
                  value={departmentQuery}
                  onChangeText={setDepartmentQuery}
                />
                <Choice
                  label={copy.all}
                  selected={!department}
                  onPress={() => {
                    setDepartment("");
                    setSpecialty("");
                    setLimit(12);
                    setDepartmentsOpen(false);
                  }}
                />
                {data.departments
                  .filter((d) =>
                    directoryText(displayName(d, locale)).includes(
                      directoryText(departmentQuery),
                    ),
                  )
                  .map((d) => (
                    <Choice
                      key={d.id}
                      label={displayName(d, locale)}
                      selected={department === d.id}
                      onPress={() => {
                        setDepartment(d.id);
                        setSpecialty("");
                        setLimit(12);
                        setDepartmentsOpen(false);
                      }}
                    />
                  ))}
              </>
            )}
            {chosen && (
              <>
                <Txt tone="muted">
                  {chosen.locationConfirmed
                    ? chosen.building +
                      " · " +
                      chosen.floors.map((f) => floorLabel(f, locale)).join(", ")
                    : copy.noLocation}
                </Txt>
                <Txt tone="heading">{copy.specialty}</Txt>
                <Choice
                  label={copy.allSpecialties}
                  selected={!specialty}
                  onPress={() => {
                    setSpecialty("");
                    setLimit(12);
                  }}
                />
                {data.specialties
                  .filter((s) => s.departmentId === department)
                  .map((s) => (
                    <Choice
                      key={s.id}
                      label={s.name}
                      selected={specialty === s.id}
                      onPress={() => {
                        setSpecialty(s.id);
                        setLimit(12);
                      }}
                    />
                  ))}
              </>
            )}
          </Card>
          <Txt>
            {results.length} {copy.results}
          </Txt>
          {!results.length && <Txt>{copy.noDoctors}</Txt>}
          {results.slice(0, limit).map((d) => {
            const dep = data.departments.find((x) => x.id === d.departmentId);
            return (
              <Card key={d.id}>
                <Txt tone="eyebrow">
                  {d.isDoctor ? copy.doctor : copy.clinician}
                </Txt>
                <Txt tone="heading">{d.name}</Txt>
                <Txt>{dep && displayName(dep, locale)}</Txt>
                <Txt>
                  {data.specialties
                    .filter((s) => d.specialtyIds.includes(s.id))
                    .map((s) => s.name)
                    .join(" · ")}
                </Txt>
                {data.clinics
                  .filter((c) => d.clinicIds.includes(c.id))
                  .map((c) => (
                    <Txt key={c.id} tone="muted">
                      {c.room ? copy.room + " " + c.room + " · " : ""}
                      {c.name} ·{" "}
                      {c.locationConfirmed
                        ? c.building + " / " + floorLabel(c.floor, locale)
                        : copy.unknown}
                    </Txt>
                  ))}
                {data.warnings.some((w) => w.doctorIds.includes(d.id)) && (
                  <Txt>{copy.review}</Txt>
                )}
              </Card>
            );
          })}
          {results.length > limit && (
            <Btn secondary onPress={() => setLimit((n) => n + 12)}>
              {copy.more}
            </Btn>
          )}
        </>
      )}
    </>
  );
}
