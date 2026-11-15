# PB-033 map source inventory

Generated from versioned source data, not a live database export. Physical coordinates are a self-designed demo; unknown building/floor values stay unknown.

## Buildings and floor coverage

| Building | Explicit demo floors | Scope |
|---|---|---|
| A | 0, 1 | Directory + explicit Journey room metadata |
| B | 0, 1, 2 | Directory + explicit Journey room metadata |
| C | -1, 0, 1, 2, 3, 4, 5, 6, 7 | Directory + explicit Journey room metadata |
| D | 0, 1, 2, 3 | Directory + explicit Journey room metadata |
| E | 0 | Demo ground-floor entrance only; department floors unconfirmed |
| F | 0 | Demo ground-floor entrance only; department floors unconfirmed |
| G | -1, 0, 1, 2, 3 | Directory + explicit Journey room metadata |

## Floor plans and mapped destinations

| Space ID | Mapped rooms / department entries |
|---|---|
| `floor:A:0` | `department-A-insurance-0`: A.1 - Khu khám Bảo hiểm y tế<br>`department-A-premium-0`: A.2 - Khu khám chữa bệnh chất lượng cao<br>`department-A-emergency-0`: A.3 - Khoa Cấp cứu<br>`department-A-outpatients-0`: A.4 - Khoa Khám bệnh<br>`department-A-services-0`: A.5 - Khoa Dịch vụ |
| `floor:A:1` | `room-A101`: A101 - Phòng khám tổng quát<br>`room-R01`: R01 - Quầy tiếp nhận<br>`room-P01`: P01 - Quầy nhà thuốc<br>`department-A-nutrition-1`: A.6 - Khoa Dinh dưỡng |
| `floor:B:0` | `department-B-imaging-0`: B.1 - Khoa Chẩn đoán hình ảnh<br>`department-B-functional-0`: B.2 - Khoa Thăm dò chức năng<br>`department-B-haematology-0`: B.3 - Khoa Huyết học – Truyền máu<br>`department-B-biochemistry-0`: B.4 - Khoa Hóa sinh – Miễn dịch |
| `floor:B:1` | `department-B-internal-1`: B.5 - Khoa Nội tổng hợp |
| `floor:B:2` | `room-B201`: B201 - Phòng lấy mẫu<br>`room-B202`: B202 - Phòng chẩn đoán hình ảnh<br>`department-B-internal-2`: B.5 - Khoa Nội tổng hợp |
| `floor:C:-1` | `department-C-pharmacy--1`: C.1 - Khoa Dược |
| `floor:C:0` | `department-C-intensive-care-0`: C.2 - Khoa Hồi sức tích cực chống độc<br>`department-C-neonatal-0`: C.3 - Khoa Hồi sức tích cực Nhi – Sơ sinh<br>`department-C-plastic-surgery-0`: C.4 - Khoa Phẫu thuật tạo hình thẩm mỹ |
| `floor:C:1` | `room-C01`: C01 - Quầy thu ngân<br>`department-C-obstetrics-1`: C.5 - Khoa Sản C<br>`department-C-thoracic-1`: C.6 - Khoa Ngoại lồng ngực mạch máu<br>`department-C-ophthalmology-1`: C.7 - Khoa Mắt |
| `floor:C:2` | `department-C-cardiac-surgery-2`: C.8 - Khu Phẫu thuật tim |
| `floor:C:3` | `department-C-cardiac-intensive-3`: C.9 - Khoa Hồi sức tim mạch<br>`department-C-isolation-3`: C.10 - Khu Cách ly |
| `floor:C:4` | `department-C-neurosurgery-4`: C.11 - Khoa Ngoại thần kinh<br>`department-C-urology-4`: C.12 - Khoa Tiết niệu – Nam khoa |
| `floor:C:5` | `department-C-ent-5`: C.13 - Khoa Tai Mũi Họng<br>`department-C-endocrinology-5`: C.14 - Khoa Nội tiết<br>`department-C-dental-5`: C.15 - Khoa Răng Hàm Mặt |
| `floor:C:6` | `department-C-orthopaedics-6`: C.16 - Khoa Ngoại chấn thương chỉnh hình |
| `floor:C:7` | `department-C-psychiatry-7`: C.17 - Khoa Tâm thể<br>`department-C-it-7`: C.18 - Phòng Công nghệ thông tin<br>`department-C-hall-7`: C.19 - Hội trường |
| `floor:D:0` | `department-D-obstetrics-0`: D.1 - Khoa Sản B<br>`department-D-infection-control-0`: D.2 - Khoa Kiểm soát nhiễm khuẩn<br>`department-D-microbiology-0`: D.3 - Khoa Vi sinh |
| `floor:D:1` | `department-D-anaesthesiology-1`: D.4 - Khoa Gây mê hồi sức |
| `floor:D:2` | `department-D-paediatrics-2`: D.5 - Khoa Nhi<br>`department-D-administration-2`: D.6 - Khu Hành chính |
| `floor:D:3` | `room-D301`: D301 - Phòng khoa khác<br>`department-D-general-surgery-3`: D.7 - Khoa Ngoại tổng hợp<br>`department-D-oncology-3`: D.8 - Khoa Ung bướu |
| `floor:E:0` | Demo lobby / entrance; no clinical destination coordinates |
| `floor:F:0` | Demo lobby / entrance; no clinical destination coordinates |
| `floor:G:-1` | `department-G-meeting--1`: G.1 - Hội trường |
| `floor:G:0` | `department-G-nephrology-0`: G.2 - Khoa Nội thận – Thận nhân tạo |
| `floor:G:1` | `department-G-nephrology-1`: G.2 - Khoa Nội thận – Thận nhân tạo |
| `floor:G:2` | `department-G-cardiology-2`: G.3 - Khoa Nội tim mạch – Lão học |
| `floor:G:3` | `department-G-cardiology-3`: G.3 - Khoa Nội tim mạch – Lão học |

## Unconfirmed departments (no destination node allocated)

| Source ID | Department | Building | Floors |
|---|---|---|---|
| `F-traditional` | Khoa Y học cổ truyền | F | ? |
| `unlocated-reception` | Phòng Tiếp công dân | ? | ? |
| `unlocated-dermatology` | Khoa Da liễu | ? | ? |
| `unlocated-rehabilitation` | Khoa Vật lý trị liệu – Phục hồi chức năng | ? | ? |
| `E-premium` | Khám chữa bệnh chất lượng cao | E | ? |
| `E-pathology` | Khoa Giải phẫu bệnh | E | ? |
| `unlocated-neurology` | Khoa Nội thần kinh | ? | ? |
| `unlocated-obstetrics` | Khoa Sản (chưa xác định B/C) | ? | ? |
| `unlocated-experts` | Phòng khám Chuyên gia | ? | ? |

## Imported clinic inventory

All 81 source clinics currently have unconfirmed building/floor metadata (12 also lack a room number). Room numbers and department membership are not floor evidence. Backend HospitalCatalog imports these with `Building=?`, `Floor=?`; PB-033 does not modify that data. When staff confirm a location, it still requires an explicit approved map allocation; no coordinates are generated from its name/number.

| Clinic ID | Source name | Room | Building | Floor | Source cell |
|---|---|---|---|---|---|
| `1ec16ace-5954-5789-9e60-741780ce9a2f` | Phòng khám Ngoài giờ | 66 | ? | ? | C228 |
| `08f66b78-2f62-59aa-a6e6-50bbb5aa2eb9` | Phòng khám Tiêm ngừa | 27 | ? | ? | C224 |
| `6fdad41f-a5c5-5ebb-b25b-e3a51d4365e6` | Phòng khám và Tư vấn dinh dưỡng | 26 | ? | ? | C222 |
| `221c1983-18ee-5bcb-aadb-b1a6302d416b` | Khám sức khỏe | 93 | ? | ? | C212 |
| `79e12276-e808-5eed-a730-4986590d3032` | Phòng khám Nội 1 | 10 | ? | ? | C204 |
| `153e0ddd-790d-5d5b-aedc-977993fce56e` | Phòng khám Nội 6 | 53 | ? | ? | C216 |
| `d0e6e415-65fd-57f8-81bd-f79c6ce9d316` | Phòng khám Nội 8 | 89 | ? | ? | C208 |
| `d2cae7cf-97b8-5159-91b3-840f3afb7459` | Phòng khám điều trị trong ngày | 68 | ? | ? | C210 |
| `c2ea8b72-247e-536e-91bd-71e9a9412fd7` | Phòng khám Bác sĩ gia đình | 35 | ? | ? | C218 |
| `5a136b46-d4f1-523c-932b-4081056376d0` | Phòng khám Nội 2 | 11 | ? | ? | C220 |
| `79f40a4e-efd1-57b5-b939-6f1a8165fba1` | Phòng khám Hô hấp | 15 | ? | ? | C35 |
| `879979b9-fc3d-5312-b496-a2ee81a0d0b6` | Phòng khám Hô hấp | 41 | ? | ? | C39 |
| `6ab579bd-267a-52c2-92a0-74f91f498e18` | Phòng khám Nội Hô hấp 2 (Khám lao) | 76 | ? | ? | C37 |
| `88f2d32f-0ae9-560d-9b5d-e49be7bb3971` | Phòng khám Nội tổng hợp - Huyết học | 56 | ? | ? | C43 |
| `0610524f-6ec7-5c66-ad90-e78584f63abd` | Phòng khám Thân thiện | 69 | ? | ? | C46 |
| `58b43d2b-aaec-5d83-8079-f1b57fd95360` | Phòng khám Tiêu hóa - Gan mật | 18 | ? | ? | C31 |
| `4009cb46-5cf7-55f8-ade5-0e278854d9b1` | Phòng khám Tiêu hóa - Viêm gan | 40 | ? | ? | C41 |
| `9595376f-b803-5476-ac38-5a53a62a61fc` | Phòng khám Viêm gan - Truyền nhiễm | 14 | ? | ? | C33 |
| `e151efd7-62b5-5712-a850-487a8f522d75` | Phòng khám Nội tim mạch 10 | 55 | ? | ? | C23 |
| `35090425-8b36-5806-aa58-7bcffab1e46d` | Phòng khám Nội tim mạch 3 | 13 | ? | ? | C15 |
| `5e2dfa4a-4628-5189-8d29-b892ab511d31` | Phòng khám Tim mạch can thiệp | 20 | ? | ? | C21 |
| `8c3c0e4e-8236-5173-9442-237df96334eb` | Phòng khám Răng hàm mặt 1 | 31 | ? | ? | C160 |
| `1fd4e53a-21a2-525f-a3b9-b74205a2a82d` | Phòng khám Răng hàm mặt 2 | 32 | ? | ? | C167 |
| `dac97d5e-9f52-5038-8485-fcae7dcedc1e` | Phòng khám Răng hàm mặt 7 | 70 | ? | ? | C164 |
| `24da3c96-3b66-52d4-bbf9-f0bca611d984` | Phòng khám Nội 3 | 16 | ? | ? | C78 |
| `c75acc03-cad1-5c65-a176-829669efbf36` | Phòng khám Nội 4 | 17 | ? | ? | C80 |
| `6bee4654-0adc-5d8b-8906-f0c5d68cd7e7` | Phòng khám Nội 5 | 51 | ? | ? | C86 |
| `2c7c1643-7a37-55d2-8a8a-3317b42d665f` | Phòng khám Tai mũi họng 1 | 04 | ? | ? | C150 |
| `d628b5d9-db87-58c6-a008-360acc55f304` | Phòng khám Tai mũi họng 2 | 42 | ? | ? | C156 |
| `771b9db3-f1f1-50fa-a1b0-28384f7f0a8c` | Phòng khám Sơ sinh và Trẻ nhỏ | 19 | ? | ? | C25 |
| `0089a1f9-98c7-52d4-b61d-6d4e28b3e22b` | Phòng khám Trẻ em | 28 | ? | ? | C29 |
| `38b15bf2-dbb2-5239-88af-918af593b477` | Phòng khám Ngoại thần kinh 1 | 01 | ? | ? | C143 |
| `171bd609-53c3-5241-bb20-bd165dff31f0` | Phòng khám Ngoại thần kinh 2 | 33 | ? | ? | C147 |
| `421a959c-0f93-5761-bb1e-76ae4ff9c73b` | Phòng khám Mắt 1 | 09 | ? | ? | C169 |
| `f04110f1-a887-563e-99d6-b0e45390feba` | Phòng khám Mắt 2 | 37 | ? | ? | C177 |
| `d7d2352e-5531-5b00-952d-3fddcb594423` | Phòng khám Chấn thương chỉnh hình 1 | 07 | ? | ? | C133 |
| `9893bf4a-ee9e-55ec-bef2-89b0ea3ed904` | Phòng khám Chấn thương chỉnh hình 2 | 08 | ? | ? | C135 |
| `f058240f-ffa8-5b05-af32-118e9e03bd1f` | Phòng khám Chấn thương chỉnh hình 3 | 44 | ? | ? | C139 |
| `04514742-7917-5297-a825-fdc4da4e4a7e` | Phòng khám Chấn thương chỉnh hình 4 | 45 | ? | ? | C141 |
| `f20256e3-e6ca-5d24-b274-65827e22c6d4` | Phòng khám Tạo hình thẩm mỹ | 67 | ? | ? | C230 |
| `f0ce92df-1a92-546b-9149-4b893f32930d` | Phòng khám Tâm lý 1 | 71 | ? | ? | C62 |
| `24dbce54-87f6-57e0-9160-f401d661eba7` | Phòng khám Tâm thần | ? | ? | ? | C64 |
| `02b386e5-de14-5423-8ef2-90c6f4a67dd1` | Phòng khám Lồng ngực - Mạch máu | 21 | ? | ? | C127 |
| `36b527d1-7fea-5bf1-8e22-5260b3d222aa` | Phòng khám Lồng ngực - Mạch máu 3 | 38 | ? | ? | C131 |
| `e409e83e-cd01-50b8-9eab-b842aeb23c30` | Phòng khám Tiết niệu - Nam khoa 1 | 03 | ? | ? | C123 |
| `097d89c3-cb9c-5053-9f3b-806a6e9ca4d7` | Phòng khám Ngoại tổng hợp 1 | 02 | ? | ? | C109 |
| `aa20eed2-4a1b-57b4-81c9-27eab5908a5d` | Phòng khám Ngoại tổng hợp 2 | 46 | ? | ? | C113 |
| `95ef51e3-d114-5316-8b53-a3c070a3dc3a` | Phòng khám Ung bướu | 39 | ? | ? | C117 |
| `5bdeb804-1b14-5be5-88ad-dcedc91e537f` | Phòng khám Ung bướu | 36 | ? | ? | C115 |
| `93421af8-18d5-5567-8a14-42c7b3a1109f` | Phòng khám Nhi 1 | 30 | ? | ? | C189 |
| `f436ed80-3f4c-537e-9d86-c27498302471` | Phòng khám Nhi 2 | 48 | ? | ? | C201 |
| `a8480001-d8c2-5e77-bd71-67dd9c602698` | Phòng khám Nhi 3 | 47 | ? | ? | C195 |
| `066a13e2-f0cc-55f0-b1ef-d170052d6f1e` | Phòng khám Y học cổ truyền | 64 | ? | ? | C88 |
| `363cccb9-4c2f-5b39-9ac5-44d40a2c2f89` | Phòng khám Y học cổ truyền | 65 | ? | ? | C93 |
| `bfd06b70-9739-5028-9004-54dc0b8a94c6` | Phòng khám Nội tim mạch 1 | 05 | ? | ? | C66 |
| `20921045-d291-5877-ac7a-cd976371d477` | Phòng khám Nội tim mạch 11 | 54 | ? | ? | C76 |
| `cb94636d-e6be-5bf5-86db-80de1ef5502a` | Phòng khám Nội tim mạch 9 | 53 | ? | ? | C74 |
| `d7f7a2fb-a934-5fcd-9f60-cef67a3c0ea9` | Phòng khám Nội tổng hợp - Thận | ? | ? | ? | C9 |
| `fafee17b-e337-5616-85fe-f4cd5413f537` | Phòng khám Nội tổng hợp - Thận | 43 | ? | ? | C13 |
| `54fb1f6d-77b1-5f70-9c2a-05f05034c6d7` | Phòng khám Da liễu 1 | 29 | ? | ? | C103 |
| `66f0df03-fe9b-5824-8beb-b4881510d6b0` | Phòng khám Da liễu 1 [N Da liễu] | 74 | ? | ? | C105 |
| `8a658b11-811d-5482-8947-e5d949cf1967` | Phòng khám Da liễu 2 | 60 | ? | ? | C107 |
| `c595fb8f-1f9e-5139-ba9f-e7ecd3a4b52f` | Phòng khám Chấn thương chỉnh hình 6 | ? | ? | ? | C240 |
| `6701af49-4a53-5166-9815-de2e24ef9a45` | Phòng khám Lồng ngực - Mạch máu 2 | ? | ? | ? | C248 |
| `21070151-d8e8-5602-a625-a8a4604fa5c2` | Phòng khám Nhi 8 | ? | ? | ? | C242 |
| `e1ccb54e-4106-58ff-ab08-14de756435c8` | Phòng khám Nội thần kinh 3 | ? | ? | ? | C234 |
| `ebc26f90-5dc1-58cb-8c33-3352462ca327` | Phòng khám Nội tim mạch 5 | ? | ? | ? | C232 |
| `b5706647-5a79-51f6-b29d-0ee043ec3e72` | Phòng khám Nội tiết 7 | ? | ? | ? | C250 |
| `d355f796-f7e5-5e2a-9514-c86dae909e19` | Phòng khám Nội tổng hợp 21 | ? | ? | ? | C236 |
| `cb454c66-da86-5e0f-b0bf-316504786746` | Phòng khám Sản - Phụ khoa 3 | ? | ? | ? | C246 |
| `3c7ae7e3-8fc4-525e-8969-39c586e61c0e` | Phòng khám Thận 9 | ? | ? | ? | C244 |
| `3edb9c6c-6894-5fbb-9c34-4eee2d81e278` | Phòng khám Tim mạch tổng quát | ? | ? | ? | C238 |
| `f9cb8b44-3ad9-567e-9bb4-5a4c23fd772c` | Phòng khám Nội thần kinh 1 | 06 | ? | ? | C52 |
| `170610ec-3346-58f1-8b9f-23425ae56654` | Phòng khám Nội thần kinh 2 | 34 | ? | ? | C60 |
| `b25a6420-c870-5641-b6eb-0a4f6e83398e` | Phòng khám Phụ khoa 1 | 25 | ? | ? | C183 |
| `38f3518b-9c64-563d-b868-d82af857139e` | Phòng khám Phụ khoa | 49 | ? | ? | C185 |
| `87df14cc-e3f3-5127-bc33-5a24b0e1d1de` | Phòng khám Sản | 50 | ? | ? | C187 |
| `0efe7477-1d28-560f-9ad2-fb2bdcb28188` | Phòng khám Thai 1 | 24 | ? | ? | C179 |
| `21dea0d1-6438-5312-baaa-c486c37512ad` | Phòng khám Thai 2 | 23 | ? | ? | C181 |
| `18eaca88-0875-583f-9cbf-e5eb419eca52` | Phòng khám VLTL - PHCN | 63 | ? | ? | C99 |
| `60ad866c-36a0-5216-a584-dc054c1587ee` | Phòng khám VLTL-PHCN | 82 | ? | ? | C95 |
