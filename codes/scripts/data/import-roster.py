"""Extract the supplied August 2025 roster. Read-only OOXML; no Excel macros/formulas run.
Usage: python scripts/data/import-roster.py <workbook.xlsx>
Names differing beyond case/whitespace/credentials remain separate for review.
"""
import collections
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata
import uuid
import xml.etree.ElementTree as ET
import zipfile

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "packages/shared/data"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
NSID = uuid.UUID("d16ad120-62f7-4217-a749-f28fce9e692b")
def clean(text):
    return " ".join(unicodedata.normalize("NFC", text or "").split())
def key(text):
    return clean(text).casefold()
def uid(text):
    return str(uuid.uuid5(NSID, text))
DEPARTMENTS = {
"NỘI THẬN - THẬN NHÂN TẠO":"G-nephrology",
"HỒI SỨC TIM MẠCH":"C-cardiac-intensive",
"HỒI SỨC TÍCH CỰC NHI - SƠ SINH":"C-neonatal",
"NỘI TỔNG HỢP":"B-internal", "NỘI THẦN KINH":"unlocated-neurology",
"TÂM THỂ":"C-psychiatry", "NỘI TIM MẠCH - LÃO HỌC":"G-cardiology",
"NỘI TIẾT":"C-endocrinology", "Y HỌC CỔ TRUYỀN":"F-traditional",
"VLTL-PHCN":"unlocated-rehabilitation", "DA LIỄU":"unlocated-dermatology",
"NGOẠI TỔNG HỢP":"D-general-surgery", "UNG BƯỚU":"D-oncology",
"TIẾT NIỆU - NAM KHOA":"C-urology", "NGOẠI LỒNG NGỰC - MẠCH MÁU":"C-thoracic",
"CHẤN THƯƠNG CHỈNH HÌNH":"C-orthopaedics", "NGOẠI THẦN KINH":"C-neurosurgery",
"TAI MŨI HỌNG":"C-ent", "RĂNG HÀM MẶT":"C-dental", "MẮT":"C-ophthalmology",
"SẢN":"unlocated-obstetrics", "NHI":"D-paediatrics", "KHOA KHÁM BỆNH":"A-outpatients",
"KHOA DỊCH VỤ":"A-services", "DINH DƯỠNG - TIẾT CHẾ":"A-nutrition",
"CẤP CỨU":"A-emergency", "ĐƠN VỊ PHẪU THUẬT THẨM MỸ":"C-plastic-surgery",
"PHÒNG KHÁM CHUYÊN GIA":"unlocated-experts", "[Khác]":None
}
DEPARTMENTS = {key(k):v for k,v in DEPARTMENTS.items()}
PREFIX = re.compile(r"^(?:(?:th\s*s?|ths)\s*\.?\s*)?(?:bs|bcski|cn)\s*\.?\s*(?:ck\s*(?:ii|i|2|1)\s*\.?\s*)?", re.I)
SPLIT = re.compile(r"\n+|\s{3,}|[-;]\s*(?=(?:Th|BS|CN))", re.I)
def names(value):
    result = []
    for part in SPLIT.split(unicodedata.normalize("NFC", value)):
        raw = clean(part)
        if not raw or key(raw) in {"nghỉ", "-", "x"}: continue
        raw = re.sub(r"\s*\(Tham Vấn\)\s*$", "", raw, flags=re.I)
        match = PREFIX.match(raw)
        prefix = match.group(0) if match else ""
        name = clean(raw[len(prefix):]).strip(". -")
        if not name: continue
        # Keep identifiers (A)/(B), diacritics and spelling from the source.
        name = name.title()
        name = re.sub(r"\(([ab])\)", lambda m:"("+m[1].upper()+")", name, flags=re.I)
        result.append((name, clean(prefix).upper(), not prefix.upper().startswith("CN"), clean(part)))
    return result
def specialty(clinic):
    text = re.sub(r"^Phòng khám\s*", "", clinic, flags=re.I)
    text = re.sub(r"\s*\[.*?\]", "", text)
    text = re.sub(r"\s+\d+(?=\s|$)", "", text)
    return clean(text)

def extract(path):
    doctors, clinics, specialties = {}, {}, {}
    warnings, provenance = [], []
    with zipfile.ZipFile(path) as z:
        ss = ["".join(t.text or "" for t in x.iter() if t.tag.endswith("}t")) for x in ET.fromstring(z.read("xl/sharedStrings.xml"))]
        rels={r.attrib["Id"]:r.attrib["Target"] for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))}
        workbook=ET.fromstring(z.read("xl/workbook.xml"))
        for sheet in workbook.find("s:sheets", NS):
            sheet_name=sheet.attrib["name"]
            target=rels[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
            file=target.lstrip("/") if target.startswith("/") else "xl/"+target
            root=ET.fromstring(z.read(file))
            cells={}
            for c in root.findall(".//s:sheetData/s:row/s:c", NS):
                v=c.find("s:v",NS)
                if v is not None: cells[c.attrib["r"]]=ss[int(v.text)] if c.attrib.get("t")=="s" else v.text
            for merge in root.findall("s:mergeCells/s:mergeCell",NS):
                a,b=merge.attrib["ref"].split(":")
                ac,ar=re.match(r"([A-Z]+)(\d+)",a).groups(); bc,br=re.match(r"([A-Z]+)(\d+)",b).groups()
                # Expand only explicitly merged header cells, never fill empty shifts.
                if ac==bc and ac in "ABCDE":
                    for r in range(int(ar), int(br)+1): cells[f"{ac}{r}"]=cells.get(a,"")
            provenance.append({"sheet":sheet_name,"title":cells.get("A4",""),"dateSerials":[cells.get(c+"7","") for c in "FGHIJKL"]})
            for row in range(9, max(int(re.search(r"\d+",a)[0]) for a in cells)+1):
                source_dept=clean(cells.get(f"A{row}",""))
                clinic_name=clean(cells.get(f"C{row}",""))
                if not source_dept or not clinic_name: continue
                if key(source_dept) not in DEPARTMENTS: raise ValueError(f"Unmapped department: {source_dept}")
                dept=DEPARTMENTS[key(source_dept)]
                if dept is None: continue # [Khác] is not a clinical department; no doctor names.
                room=clean(cells.get(f"B{row}",""))
                room=None if room in ("","?") else room
                spec=specialty(clinic_name)
                sid=uid("specialty:"+dept+":"+key(spec))
                cid=uid("clinic:"+dept+":"+str(room)+":"+key(clinic_name))
                specialties.setdefault(sid,{"id":sid,"departmentKey":dept,"name":spec})
                clinics.setdefault(cid,{"id":cid,"departmentKey":dept,"specialtyId":sid,"name":clinic_name,"room":room,"building":None,"floor":None,"source":{"sheet":sheet_name,"cell":f"C{row}"}})
                for col in "FGHIJKL":
                    value=cells.get(f"{col}{row}","")
                    for name,title,is_doctor,raw in names(value):
                        did=uid("clinician:"+dept+":"+key(name))
                        doctor=doctors.setdefault(did,{"id":did,"name":name,"departmentKey":dept,"isDoctor":is_doctor,"titles":[],"specialtyIds":[],"clinicIds":[],"sourceVariants":[]})
                        if title and title not in doctor["titles"]: doctor["titles"].append(title)
                        if sid not in doctor["specialtyIds"]: doctor["specialtyIds"].append(sid)
                        if cid not in doctor["clinicIds"]: doctor["clinicIds"].append(cid)
                        if not any(x["text"]==raw for x in doctor["sourceVariants"]):
                            doctor["sourceVariants"].append({"text":raw,"sheet":sheet_name,"cell":f"{col}{row}"})
    # Flag likely spelling conflicts for review; do not silently identify people.
    from difflib import SequenceMatcher
    items=list(doctors.values())
    for i,a in enumerate(items):
        for b in items[i+1:]:
            if a["departmentKey"]==b["departmentKey"] and not (re.search(r"\([AB]\)$",a["name"]) and re.search(r"\([AB]\)$",b["name"])) and SequenceMatcher(None,key(a["name"]),key(b["name"])).ratio()>=.88:
                warnings.append({"kind":"similarNames","doctorIds":[a["id"],b["id"]],"detail":a["name"]+" / "+b["name"]})
    for a in items:
        if any("BCSKI" in t for t in a["titles"]):
            warnings.append({"kind":"sourceTitle","doctorIds":[a["id"]],"detail":a["name"]+": nguồn ghi BCSKI"})
    warnings.append({"kind":"dateMismatch","doctorIds":[],"detail":"Tab 18.08-24.08: A4 ghi 18–24/08/2025 nhưng F7:L7 chứa 25–31/08/2025. Không dùng để suy ra lịch hiện tại."})
    warnings.append({"kind":"departmentAmbiguous","doctorIds":[],"detail":"Khoa Sản trong Excel chưa phân biệt Sản B / Sản C. Giữ thành mục cần xác nhận."})
    return {"version":"thu-duc-2025-08-v1","source":{"fileName":path.name,"sha256":hashlib.sha256(path.read_bytes()).hexdigest(),"period":"2025-08","sheets":provenance},
            "specialties":sorted(specialties.values(),key=lambda x:(x["departmentKey"],x["name"])),
            "clinics":sorted(clinics.values(),key=lambda x:(x["departmentKey"],x["name"])),
            "clinicians":sorted(items,key=lambda x:(x["departmentKey"],x["name"])),"warnings":warnings}
if __name__=="__main__":
    result=extract(Path(sys.argv[1]))
    output=DATA/"hospital-roster.json"
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"clinicians":len(result["clinicians"]),"doctors":sum(d["isDoctor"] for d in result["clinicians"]),"specialties":len(result["specialties"]),"clinics":len(result["clinics"]),"warnings":result["warnings"]},ensure_ascii=False))
