"""Generate the per-requirement register from the locally extracted PRD."""
from pathlib import Path
import csv
import re
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
docs = root / "docs" / "requirements"
lines = (docs / "PRD-extracted.txt").read_text(encoding="utf-8").splitlines()
groups = {
    "AUTH": ("Identity/IdentityEndpoints.cs; Identity/Access.cs", "Auth; Profile; LinkAccount (web/native)", "/api/auth/*; /api/external/link", "API 1,6,7,10,12,13; browser conversion; android-account cancellation/conversion/restart"),
    "APT": ("Reception/ReceptionEndpoints.cs; Integrations/Adapters.cs", "PatientReception/Reception; StaffReception", "/api/appointments*; /api/requests/{id}/booking", "API 11; provider-failure"),
    "REG": ("Reception/ReceptionEndpoints.cs", "PatientReception/Reception; StaffReception", "/api/requests*; /api/reception/*", "API 1,11,13; browser reception; android-smoke walk-in"),
    "VISIT": ("Reception/ReceptionEndpoints.cs; Journeys/Workflow.cs", "StaffClinical; PatientJourney/Journey", "/api/requests/{id}/confirm; /api/visits/*", "API 1,2,3,4,11,14; browser cashier; android-smoke pharmacy closure"),
    "JRN": ("Journeys/Workflow.cs; Journeys/JourneyEndpoints.cs", "PatientJourney/Journey; StaffClinical", "/api/visits/*; /api/tickets/redeem", "API 1,2,3,4,8,14; browser guest journey; android-smoke"),
    "NAR": ("Content/ContentEndpoints.cs; Integrations/Adapters.cs", "PatientJourney; PatientRecords; native Journey/Records", "/api/visits/{id}/narration; /api/requests/{id}/narration", "API 5; browser speech failure; provider-failure; android-smoke narration/text fallback"),
    "NAV": ("Support/SupportEndpoints.cs", "PatientJourney directions; native DirectionsScreen", "/api/visits/{id}/navigation", "API 9; browser destination fallback; android-smoke directions"),
    "NOT": ("Journeys/JourneyEndpoints.cs; Support/SupportEndpoints.cs", "Queue card; Notifications (web/native)", "/api/visits/{id}/steps/{stepId}/queue; /api/notifications*", "API 9; source review; UI polling"),
    "AST": ("Support/SupportEndpoints.cs", "HelpPanel/Help; StaffSupport", "/api/assistance*", "API 9; browser assistance; performance write; android-smoke assistance"),
    "HIS": ("Journeys/JourneyEndpoints.cs; Content/ContentEndpoints.cs", "History; Results (web/native)", "/api/visits?offset=&limit=; /api/visits/{id}/content", "API 5,6,7,10,11; browser conversion; android-account retained history"),
    "FUP": ("Content/ContentEndpoints.cs; Reception/ReceptionEndpoints.cs", "StaffContent; PatientRecords/Records", "/api/visits/{id}/follow-ups; /api/appointments*", "API 11; source review (booking URL conditional)"),
    "ADM": ("Administration/AdminEndpoints.cs", "Admin", "/api/admin/*", "API 8,14,15; source review of remaining config forms"),
    "QR": ("Reception/QrService.cs; Reception/ReceptionEndpoints.cs", "HospitalEntry; Scanner; TicketPanel; native ScanTicket", "/api/entry; /api/reception/scan; /api/tickets/redeem", "API 1,10,12; browser reception/activation; android-smoke hguide link and denied camera"),
    "DOC": ("Content/ContentEndpoints.cs", "StaffContent; PatientRecords/Records", "/api/visits/{id}/drafts*; /content; /narration; /summaries/*", "API 5; browser private draft/publication"),
}
nfr = {
    "USAB-01": "Journey places current status, next action, destination and wait/proceed together; browser and Android emulator screenshots. Physical-device matrix outstanding.",
    "USAB-02": "Listen/Navigate/Help within two actions from Journey; guest beside sign-in/register; browser and android-smoke scenarios.",
    "PERF-01": "tests/api/performance.mjs; artifacts/performance.json after a new run; 20 users, 10000 seeded steps, 620 measured requests, p95 per operation <=2000ms. Short local workload only.",
    "PERF-02": "Configured 5-second timeout; tests/api/provider-failure.mjs checks Timeout and Unavailable at 1 second; unchanged local state.",
    "SEC-01": "Access.cs ownership, guest grant, staff scope; API 1,5,7,9 and patient clinical-write denial.",
    "SEC-02": "Opaque QR, hashed sessions, HttpOnly/SameSite, optional localhost HTTPS/Secure cookie. Local certificate is self-signed; no production deployment audit.",
    "PRIV-01": "Minimal profile/request data; guest duration and optional account link displayed; source/browser review.",
    "PRIV-02": "docs/architecture/API.md documents retention and source references. Demo retains data; production policy/purge approval remains outstanding.",
    "SEC-03": "API 6,7,10: verified claims, replay denied, renewed sessions, unchanged IDs; browser and android-account conversion.",
    "REL-01": "SQL persistence; API/browser reload and android-smoke SecureStore process restart reconstruct the same Journey.",
    "REL-02": "CommandBus transaction/application lock + unique keys; API 1 parallel confirmations, API 2 duplicate event, API 13 payload-key conflict.",
    "REL-03": "Resource hooks retain RAM data, stale time, sequence guard; browser offline completion refused then retry succeeds; observed native timeout/retry retains Journey (android-retry.json).",
    "REL-04": "API 6,7 failed/cancelled conversion retains guest; cookie issued only after commit; browser conversion; android-account cancellation and successful conversion.",
    "ACC-01": "Semantic labels/dialogs/keyboard controls and stop playback; browser desktop/mobile. Android Journey tested at 130% system font scale in Vietnamese. Formal screen-reader audit and physical-device matrix remain outstanding.",
    "ACC-02": "Browser/provider narration failures retain text; android-smoke observes native playback state or readable audio error. Audible VI/EN voice quality remains unverified.",
    "LOC-01": "Shared externalized vi/en UI; separate published templates/medical translations; browser Vietnamese patient/English doctor and native English/Vietnamese Journey.",
    "LOC-02": "Browser language switch retains Visit URL; android-account EN-to-VI cold-start deep link retains Visit/Journey after conversion; saved language cannot overwrite the explicit link language.",
    "LOC-03": "API 5: approved source revision required; stale narration 409 after correction; no auto medical translation.",
    "LOC-04": "API 5 fallback to authorized source with language flag; UI original source/fallback labels.",
    "MNT-01": "Admin forms + validated mapping DAG, versioned templates; API 8,14. Full configuration form matrix not automated.",
    "MNT-02": "Single backend deployment, modules and centralized Workflow; Docker API build.",
    "COMP-01": "Chromium desktop/Pixel 7 browser tests and Android API 36 emulator native tests. iOS, physical Android devices and Safari/Firefox remain unverified.",
    "DEL-01": "Lockfiles, Docker builds, local Android APK with signature/manifest verification. GitHub workflow/APK job not yet run.",
}
br_groups = {1:"QR",2:"AUTH",3:"REG",4:"JRN",5:"FUP",6:"JRN",7:"DOC",8:"DOC",9:"NAR",10:"VISIT",11:"NAV",12:"AUTH",13:"QR",14:"REG",15:"AUTH",16:"JRN",17:"VISIT",18:"JRN",19:"JRN",20:"AUTH",21:"DOC",22:"DOC",23:"FUP",24:"HIS",25:"ADM"}
usecases = [
    ("Authenticate/Register", "AUTH"), ("Retrieve/confirm appointment", "APT"), ("Prepare walk-in", "REG"),
    ("Follow Journey", "JRN"), ("Listen to narration", "NAR"), ("Navigate", "NAV"), ("Manage orders", "JRN"),
    ("Structured reception instruction", "REG"), ("Request assistance", "AST"), ("View history", "HIS"),
    ("Follow-up recommendation", "FUP"), ("Configure workflow/content", "ADM"), ("Hospital QR entry", "QR"),
    ("Confirm reception/ticket", "REG"), ("Activate/resume Journey", "JRN"), ("Link guest to account", "AUTH"),
    ("Consultation/service progress", "JRN"), ("Settlement/Visit closure", "VISIT"), ("Complete Journey", "JRN"),
    ("Publish doctor content", "DOC"), ("Review doctor content", "DOC"),
]
rows = []
for index, line in enumerate(lines):
    requirement = line.strip()
    if re.fullmatch(r"FR-[A-Z]+-\d+|NFR-[A-Z]+-\d+|BR-\d+", requirement):
        text = lines[index + 1].strip()
        if requirement.startswith("NFR-"):
            key = requirement[4:]
            rows.append([requirement, text, "Cross-cutting; see tests/README.md", "Web/native/backend", "Applicable protected API", nfr[key], "Implemented with verification limits listed in evidence"])
        else:
            group = requirement.split("-")[1] if requirement.startswith("FR") else br_groups[int(requirement[3:])]
            module, screens, api, evidence = groups[group]
            rows.append([requirement, text, "backend/Hospital.Api/" + module, screens, api, evidence, "Implemented; test references cover the capability group, not every alternative"])
for index, (name, group) in enumerate(usecases, 1):
    module, screens, api, evidence = groups[group]
    rows.append([f"UC-{index:02d}", name, "backend/Hospital.Api/" + module, screens, api, evidence, "Implemented; see evidence for tested paths and remaining verification"])
with (docs / "TRACEABILITY.csv").open("w", encoding="utf-8-sig", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(["ID", "PRD requirement", "Implementation", "Screen", "API", "Evidence / remaining verification", "Status"])
    writer.writerows(rows)
md = ["# Truy vết yêu cầu", "", f"[TRACEABILITY.csv](TRACEABILITY.csv) có {len(rows)} dòng riêng cho toàn bộ FR, NFR, 25 BR và 21 UC. Yêu cầu được trích từ PRD-extracted.txt; module/màn hình/API và bằng chứng được đối chiếu theo nhóm chức năng. Tham chiếu test không có nghĩa mọi nhánh của từng yêu cầu đều đã được tự động kiểm tra.", "", "Tên/số UC lấy theo 21 đặc tả chi tiết của PRD; bảng tổng quan trong tài liệu có một số tham chiếu số UC lệch (ví dụ navigation/queue/history). Không dùng những số lệch đó để đổi nghiệp vụ.", "", "## 21 use case", "", "| UC | Chức năng | Màn hình | API | Bằng chứng |", "|---|---|---|---|---|"]
for index, (name, group) in enumerate(usecases, 1):
    _, screen, api, evidence = groups[group]
    md.append(f"| UC-{index:02d} | {name} | {screen} | `{api}` | {evidence} |")
md += ["", "## NFR và giới hạn kiểm chứng", "", "| NFR | Kiểm chứng / giới hạn |", "|---|---|"]
md += [f"| NFR-{key} | {value} |" for key, value in nfr.items()]
md += ["", "Các số API tham chiếu thứ tự test trong tests/api/api.test.mjs. Chạy lại theo [hướng dẫn kiểm thử](../../tests/README.md), kết quả mới nằm trong artifacts/. Các tham chiếu kiểm chứng ở trên mô tả phạm vi và giới hạn đã ghi nhận; báo cáo cũ được lưu cục bộ theo [chỉ mục archive](../../archive/README.md), không đi kèm bản clone. Source web trong apps/web/src, native trong apps/mobile/src. Tích hợp thật chưa được tuyên bố hoàn tất.", ""]
(docs / "TRACEABILITY.md").write_text("\n".join(md), encoding="utf-8")

mx = ET.Element("mxfile", host="app.diagrams.net", version="26.0.0")
def diagram(name, nodes, edges):
    page = ET.SubElement(mx, "diagram", name=name, id=name)
    model = ET.SubElement(page, "mxGraphModel", dx="1400", dy="900", grid="1", gridSize="10", page="1", pageWidth="1400", pageHeight="900")
    graph = ET.SubElement(model, "root")
    ET.SubElement(graph, "mxCell", id="0"); ET.SubElement(graph, "mxCell", id="1", parent="0")
    for ident, label, x, y, color in nodes:
        cell = ET.SubElement(graph, "mxCell", id=ident, value=label, vertex="1", parent="1", style=f"rounded=1;whiteSpace=wrap;html=0;fillColor={color};strokeColor=#126f61;fontSize=14;")
        ET.SubElement(cell, "mxGeometry", x=str(x), y=str(y), width="260", height="90", **{"as":"geometry"})
    for index, (source, target, label) in enumerate(edges):
        cell = ET.SubElement(graph, "mxCell", id=f"e{index}", source=source, target=target, value=label, edge="1", parent="1", style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=0;endArrow=block;fontSize=12;")
        ET.SubElement(cell, "mxGeometry", relative="1", **{"as":"geometry"})
diagram("Implementation", [
    ("web","React web / Nginx\nPatient + five staff roles",60,60,"#e5f3eb"),
    ("mobile","React Native / Expo\nPatient, SecureStore, camera, speech",400,60,"#e5f3eb"),
    ("api","ASP.NET Core 10 modular monolith\nAccess + validation + command bus",230,230,"#dceafa"),
    ("reception","Identity / Reception / QR\nVerified patient + exactly one ticket",60,410,"#fff1cc"),
    ("workflow","Journeys / Workflow / Orders\nVisit and Journey independent",400,410,"#fff1cc"),
    ("content","Content / Support / Admin\nPublished versions, scope, configuration",740,410,"#fff1cc"),
    ("sql","SQL Server 2022\nFK, unique indexes, versions, audit\ntransaction + SQL application lock",230,620,"#e5e0f5"),
    ("adapters","Typed adapters\nDeterministic Simulation\nDeviceSpeech manifest",850,230,"#fce1db"),
], [("web","api","Cookie / JSON / poll 5s"),("mobile","api","Bearer / JSON / poll 5s"),("api","reception",""),("api","workflow",""),("api","content",""),("reception","sql","EF Core"),("workflow","sql","EF Core"),("content","sql","EF Core"),("api","adapters","Finite timeout; failure preserves state")])
diagram("Lifecycle", [
    ("prepare","Account / booking / request\nNo Visit yet",80,70,"#e5f3eb"),
    ("confirmed","Authorized reception confirmation\nVisit Active + Journey PendingActivation",460,70,"#fff1cc"),
    ("active","Authorized ticket redemption\nJourney Active; keep progress",850,70,"#e5f3eb"),
    ("clinical","Consultation + required services\nRequired return + current settlement",460,290,"#dceafa"),
    ("closed","Visit Closed\nPreserve Journey activation state",460,500,"#dceafa"),
    ("pharmacy","Final pharmacy guidance Ready\nPatient confirmation is guidance only",850,500,"#fff1cc"),
    ("completed","Journey Completed\nPublished content remains authorized",460,710,"#e5f3eb"),
], [("prepare","confirmed","One atomic creation"),("confirmed","active","No duplicate Visit"),("confirmed","clinical","Staff events"),("active","clinical",""),("clinical","closed","All guards + WorkRevision match"),("closed","pharmacy","Pharmacy required"),("closed","completed","No pharmacy remaining"),("pharmacy","completed","Visit Closed + Journey Active")])
ET.indent(mx)
ET.ElementTree(mx).write(root / "docs" / "diagrams" / "implementation.drawio", encoding="utf-8", xml_declaration=True)
print(f"Generated {len(rows)} requirement rows, 21 UC, {len(nfr)} NFR, and 2 editable diagram pages.")
