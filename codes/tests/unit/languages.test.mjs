import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { languages, normalizeLocale, speechLocale, voiceMatches } from "../../packages/shared/src/locales.ts";
import { localizeText } from "../../packages/shared/src/localizedText.ts";
import { hospitalMap, mapCopy, shortestPath, routeInstructions, mapLabel, routeLanguage } from "../../packages/shared/src/hospitalMap.ts";
import { directoryCopy } from "../../packages/shared/src/directory.ts";
import { mapDepartments, departmentLabel } from "../../packages/shared/src/hospitalDepartments.ts";

const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL("../../packages/shared/src/i18n.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, { exports, require: file => JSON.parse(readFileSync(new URL("../../packages/shared/src/" + file, import.meta.url), "utf8")) });

test("all six locales have complete UI, directory and map dictionaries", () => {
  assert.deepEqual(languages.map(l => l.code), ["vi", "en", "zh", "ko", "ja", "ru"]);
  const keys = Object.keys(exports.messages.vi).sort();
  for (const { code } of languages) {
    assert.deepEqual(Object.keys(exports.messages[code]).sort(), keys);
    assert.ok(Object.values(exports.messages[code]).every(t => typeof t === "string" && t.trim()));
    assert.deepEqual(Object.keys(mapCopy[code]), Object.keys(mapCopy.vi));
    assert.deepEqual(Object.keys(directoryCopy[code]), Object.keys(directoryCopy.vi));
    if (code !== "vi") {
      for (const [key, value] of Object.entries(mapCopy[code])) assert.notEqual(value, mapCopy.vi[key], `${code}: map ${key}`);
      for (const [key, value] of Object.entries(directoryCopy[code])) assert.notEqual(value, directoryCopy.vi[key], `${code}: directory ${key}`);
    }
  }
});

test("route text and all fixed labels are localized without changing identifiers", () => {
  const route = shortestPath(hospitalMap, "gate-1", "room-B201");
  assert.ok(route);
  for (const { code } of languages.filter(l => l.code !== "vi")) {
    for (const department of mapDepartments) assert.notEqual(departmentLabel(department, code), department.nameVi, `${code} ${department.nameVi}`);
    for (const node of hospitalMap.nodes) assert.notEqual(mapLabel(node, code), `${node.room ? node.room + " · " : ""}${node.nameVi}`, `${code} ${node.nameVi}`);
    const text = routeInstructions(route, code).join(" ");
    assert.ok(text.includes("B201"));
    assert.doesNotMatch(text, /Bắt đầu|Đi theo|Đây là|\{(?:place|building|floor)\}/);
  }
});

test("unknown source text stays Vietnamese; voice matching respects real language", () => {
  const route = shortestPath(hospitalMap, "gate-1", "room-B201");
  assert.equal(routeLanguage(route, "ja"), "ja");
  const custom = { ...route, nodes: route.nodes.map((n, i) => i ? n : { ...n, name: "Tên mới", nameVi: "Tên mới", fallback: true }) };
  assert.equal(routeLanguage(custom, "ja"), "vi");
  assert.ok(routeInstructions(custom, routeLanguage(custom, "ja")).join(" ").includes("Bắt đầu"));
  assert.equal(localizeText("Nội dung mới chưa có bản dịch", "ja"), "Nội dung mới chưa có bản dịch");
  assert.equal(normalizeLocale("unsupported"), "vi");
  for (const { code, speech } of languages) {
    assert.equal(speechLocale(code), speech);
    assert.ok(voiceMatches(speech, code));
    assert.equal(voiceMatches("fr-FR", code), false);
  }
  assert.equal(voiceMatches("zh-TW", "zh"), false);
  assert.equal(voiceMatches("yue-HK", "zh"), false);
  assert.ok(voiceMatches("cmn-Hans-CN", "zh"));
});
