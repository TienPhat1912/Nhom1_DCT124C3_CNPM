# TODO --- Đồ án Công nghệ phần mềm

## Đề tài: FE DEV (React Native + React.js) chuyên nghiệp xử lý giao diện Web, Mobile và CI/CD

> **Thời gian:** 12 tuần\
> **Tuần hiện tại:** Tuần 1\
> **Đánh giá giữa kỳ:** Tuần 7\
> **Nộp đồ án cuối kỳ:** Tuần 12\
> **Quy mô nhóm:** 3 thành viên

------------------------------------------------------------------------

# 1. Mục tiêu dự án

-   [ ] Xây dựng Frontend Web bằng **React.js**.
-   [ ] Xây dựng Frontend Mobile bằng **React Native**.
-   [ ] Thiết kế giao diện chuyên nghiệp, responsive và nhất quán.
-   [ ] Xây dựng component có khả năng tái sử dụng.
-   [ ] Áp dụng quy trình Git/GitHub cho làm việc nhóm.
-   [ ] Áp dụng Pull Request và Code Review.
-   [ ] Xây dựng quy trình **CI/CD**.
-   [ ] Kiểm thử Web và Mobile.
-   [ ] Có MVP chạy được trước/đến tuần 7 để đánh giá giữa kỳ.
-   [ ] Hoàn thiện sản phẩm, tài liệu và báo cáo để nộp tuần 12.

------------------------------------------------------------------------

# 2. Phân công nhóm

## TV1 --- FE Web Developer

### Trách nhiệm chính

-   [ ] React.js.
-   [ ] Web UI.
-   [ ] Responsive Web.
-   [ ] Routing.
-   [ ] Components.
-   [ ] Form/Input.
-   [ ] Loading/Error states.
-   [ ] Tích hợp API/Mock data.
-   [ ] Testing Web.
-   [ ] Build Web production.

### Output

-   [ ] Web App hoàn chỉnh.
-   [ ] Source code Web.
-   [ ] Test Web.
-   [ ] Build/Deployment Web.
-   [ ] Tài liệu kỹ thuật Web.

------------------------------------------------------------------------

## TV2 --- FE Mobile Developer

### Trách nhiệm chính

-   [ ] React Native.
-   [ ] Mobile UI.
-   [ ] Navigation.
-   [ ] Screen.
-   [ ] Responsive theo kích thước màn hình.
-   [ ] Form/Input.
-   [ ] State management.
-   [ ] Tích hợp API/Mock data.
-   [ ] Testing Mobile.

### Output

-   [ ] Mobile App hoàn chỉnh.
-   [ ] Source code Mobile.
-   [ ] Test Mobile.
-   [ ] Mobile build.
-   [ ] Tài liệu kỹ thuật Mobile.

------------------------------------------------------------------------

## TV3 --- Architecture + UI/UX + CI/CD

### Trách nhiệm chính

-   [ ] Phân tích yêu cầu.
-   [ ] Thiết kế UI/UX.
-   [ ] Figma.
-   [ ] Design System.
-   [ ] Component guideline.
-   [ ] Frontend Architecture.
-   [ ] Coding Convention.
-   [ ] Git/GitHub workflow.
-   [ ] Pull Request/Code Review.
-   [ ] CI/CD.
-   [ ] Testing strategy.
-   [ ] Documentation.
-   [ ] Final Integration.

### Output

-   [ ] Requirement.
-   [ ] Figma.
-   [ ] Design System.
-   [ ] Architecture.
-   [ ] Git workflow.
-   [ ] CI/CD pipeline.
-   [ ] Testing strategy.
-   [ ] README.
-   [ ] Final documentation.

------------------------------------------------------------------------

# 3. GitHub Workflow

## Branch

``` text
main
│
├── develop
│
├── feature/web-...
├── feature/mobile-...
├── feature/ui-...
└── feature/cicd-...
```

## Quy trình làm việc

``` text
Issue
  ↓
Feature Branch
  ↓
Development
  ↓
Commit
  ↓
Push GitHub
  ↓
Pull Request
  ↓
Code Review
  ↓
Merge develop
  ↓
Test
  ↓
Merge main
  ↓
CI/CD
  ↓
Deploy
```

## Quy định

-   [ ] Mỗi task phải có Issue.
-   [ ] Không code trực tiếp trên `main`.
-   [ ] Mỗi thành viên tạo branch cho feature/task.
-   [ ] Mỗi feature phải được Push lên GitHub.
-   [ ] Sử dụng Pull Request.
-   [ ] Có Code Review trước khi merge.
-   [ ] Mỗi tuần phải có commit thể hiện tiến độ.
-   [ ] Không dồn toàn bộ code đến tuần 7 hoặc tuần 12.
-   [ ] Kiểm tra CI trước khi merge.

------------------------------------------------------------------------

# 4. Quy tắc Commit

Không sử dụng các commit message kiểu:

``` text
update
test
fix
abc
final
final2
final_final
```

Sử dụng Conventional Commit:

``` text
feat: add login page
feat: add mobile navigation
fix: fix responsive layout
fix: validate login form
refactor: improve component structure
test: add login component tests
ci: add github actions workflow
docs: update installation guide
```

------------------------------------------------------------------------

# 5. Kế hoạch 12 tuần

# TUẦN 1 --- Khởi động dự án

## Mục tiêu

Hiểu đề tài, phân tích yêu cầu và thiết lập môi trường làm việc nhóm.

### TV1 --- Web

-   [ ] Tìm hiểu React.js.
-   [ ] Khảo sát các màn hình Web cần xây dựng.
-   [ ] Xác định cấu trúc Web App.
-   [ ] Khởi tạo React.js project.
-   [ ] Push project lên GitHub.

### TV2 --- Mobile

-   [ ] Tìm hiểu React Native.
-   [ ] Khảo sát các màn hình Mobile cần xây dựng.
-   [ ] Xác định cấu trúc Mobile App.
-   [ ] Khởi tạo React Native project.
-   [ ] Push project lên GitHub.

### TV3 --- Architecture/UI/CI

-   [ ] Phân tích yêu cầu.
-   [ ] Xác định chức năng.
-   [ ] Tạo GitHub Repository.
-   [ ] Tạo Issues.
-   [ ] Tạo Milestones.
-   [ ] Thiết lập branch strategy.
-   [ ] Thiết lập README.
-   [ ] Xây dựng cấu trúc project.
-   [ ] Thống nhất coding convention.

### Deliverable cuối tuần 1

-   [ ] GitHub Repository.
-   [ ] README.md.
-   [ ] Requirement list.
-   [ ] Issue list.
-   [ ] Branch strategy.
-   [ ] Project structure.
-   [ ] Web project skeleton.
-   [ ] Mobile project skeleton.

------------------------------------------------------------------------

# TUẦN 2 --- UI/UX và Architecture

## Mục tiêu

Hoàn thành thiết kế và kiến trúc Frontend.

### TV1 --- Web

-   [ ] Xây dựng Web layout.
-   [ ] Header.
-   [ ] Navigation.
-   [ ] Main layout.
-   [ ] Các page cơ bản.
-   [ ] Chuẩn bị responsive structure.

### TV2 --- Mobile

-   [ ] Xây dựng Mobile navigation.
-   [ ] Navigation Stack/Tab.
-   [ ] Các screen cơ bản.
-   [ ] Splash screen nếu cần.
-   [ ] Login/Register screen skeleton.

### TV3 --- Architecture/UI

-   [ ] Thiết kế Figma.
-   [ ] Wireframe.
-   [ ] Design System.
-   [ ] Typography.
-   [ ] Màu sắc.
-   [ ] Button/Input/Card components.
-   [ ] UI guideline.
-   [ ] Frontend Architecture.
-   [ ] Quy định folder structure.
-   [ ] Coding convention.

### Deliverable cuối tuần 2

-   [ ] Figma.
-   [ ] Wireframe.
-   [ ] UI Design.
-   [ ] Design System.
-   [ ] Frontend Architecture.
-   [ ] Web skeleton.
-   [ ] Mobile skeleton.

------------------------------------------------------------------------

# TUẦN 3 --- Core UI

## Mục tiêu

Xây dựng các thành phần giao diện cốt lõi.

### TV1 --- Web

-   [ ] Header.
-   [ ] Navigation.
-   [ ] Home.
-   [ ] Login/Register.
-   [ ] Main Layout.
-   [ ] Reusable Web components.

### TV2 --- Mobile

-   [ ] Splash.
-   [ ] Login.
-   [ ] Register.
-   [ ] Home.
-   [ ] Navigation.
-   [ ] Reusable Mobile components.

### TV3 --- Architecture/CI

-   [ ] Component guideline.
-   [ ] Thiết lập linting.
-   [ ] Thiết lập formatting.
-   [ ] Kiểm tra coding convention.
-   [ ] Bắt đầu CI.
-   [ ] Thiết lập GitHub Actions.

### Deliverable

-   [ ] Web UI core chạy được.
-   [ ] Mobile UI core chạy được.
-   [ ] Reusable components.
-   [ ] CI phiên bản đầu tiên.

------------------------------------------------------------------------

# TUẦN 4 --- Phát triển chức năng chính

## Mục tiêu

Bắt đầu implement các chức năng chính của sản phẩm.

### TV1 --- Web

-   [ ] Implement các chức năng chính trên Web.
-   [ ] Routing.
-   [ ] Form.
-   [ ] Validation.
-   [ ] State.
-   [ ] Loading state.
-   [ ] Error state.

### TV2 --- Mobile

-   [ ] Implement các chức năng chính trên Mobile.
-   [ ] Navigation.
-   [ ] Form.
-   [ ] Validation.
-   [ ] State.
-   [ ] Loading state.
-   [ ] Error state.

### TV3 --- Architecture/Integration

-   [ ] State management strategy.
-   [ ] API/Mock service.
-   [ ] Service layer.
-   [ ] Component architecture.
-   [ ] Review code Web.
-   [ ] Review code Mobile.
-   [ ] Kiểm tra CI.

### Deliverable

-   [ ] Core functionality v1.
-   [ ] Web có chức năng chính.
-   [ ] Mobile có chức năng chính.
-   [ ] API/Mock integration.

------------------------------------------------------------------------

# TUẦN 5 --- Hoàn thiện MVP

## Mục tiêu

Đưa sản phẩm lên khoảng 80% để chuẩn bị kiểm thử trước giữa kỳ.

### TV1 --- Web

-   [ ] Hoàn thiện Web features.
-   [ ] Responsive.
-   [ ] Validation.
-   [ ] Error handling.
-   [ ] UI polishing.

### TV2 --- Mobile

-   [ ] Hoàn thiện Mobile features.
-   [ ] Responsive.
-   [ ] Validation.
-   [ ] Error handling.
-   [ ] UI polishing.

### TV3 --- Integration

-   [ ] Tích hợp Web/Mobile.
-   [ ] Code Review.
-   [ ] Test.
-   [ ] CI.
-   [ ] Chuẩn hóa UI.
-   [ ] Kiểm tra architecture.

### Deliverable cuối tuần 5

-   [ ] Web \~80%.
-   [ ] Mobile \~80%.
-   [ ] Core features hoàn thành.
-   [ ] CI hoạt động.
-   [ ] MVP gần hoàn chỉnh.

------------------------------------------------------------------------

# TUẦN 6 --- Integration và Testing

## Mục tiêu

Ổn định MVP trước đánh giá giữa kỳ.

### Công việc chung

-   [ ] Merge Web.
-   [ ] Merge Mobile.
-   [ ] Fix Git conflicts.
-   [ ] Test chức năng.
-   [ ] Test UI.
-   [ ] Test navigation.
-   [ ] Test validation.
-   [ ] Fix bug.
-   [ ] Kiểm tra responsive.
-   [ ] Chuẩn bị demo giữa kỳ.

### TV1

-   [ ] Web testing.
-   [ ] Fix Web bugs.
-   [ ] Chuẩn bị Web demo.

### TV2

-   [ ] Mobile testing.
-   [ ] Fix Mobile bugs.
-   [ ] Chuẩn bị Mobile demo.

### TV3

-   [ ] Integration testing.
-   [ ] CI testing.
-   [ ] Documentation.
-   [ ] Kiểm tra GitHub.
-   [ ] Chuẩn bị nội dung demo.

### Deliverable

-   [ ] MVP ổn định.
-   [ ] Web chạy được.
-   [ ] Mobile chạy được.
-   [ ] CI chạy được.
-   [ ] Demo script.
-   [ ] Midterm documentation.

------------------------------------------------------------------------

# TUẦN 7 --- ĐÁNH GIÁ GIỮA KỲ

## Mục tiêu

Demo được MVP và chứng minh quy trình phát triển phần mềm.

### Nội dung demo

-   [ ] Giới thiệu đề tài.
-   [ ] Problem/Requirements.
-   [ ] UI/UX.
-   [ ] Frontend Architecture.
-   [ ] Web App.
-   [ ] Mobile App.
-   [ ] Git/GitHub workflow.
-   [ ] CI.
-   [ ] Testing.
-   [ ] Demo chức năng.
-   [ ] Kế hoạch giai đoạn cuối.

### Checklist trước khi demo

-   [ ] Web chạy ổn định.
-   [ ] Mobile chạy ổn định.
-   [ ] Không còn bug nghiêm trọng.
-   [ ] GitHub có lịch sử commit rõ ràng.
-   [ ] Issues được cập nhật.
-   [ ] Pull Requests có Code Review.
-   [ ] CI chạy thành công.
-   [ ] README có hướng dẫn chạy project.
-   [ ] Có screenshot/demo.
-   [ ] Có nội dung trình bày.

### Milestone

**M3 --- MVP**

------------------------------------------------------------------------

# TUẦN 8 --- Refactor

## Mục tiêu

Cải thiện chất lượng code sau giữa kỳ.

### TV1 --- Web

-   [ ] Refactor Web.
-   [ ] Component hóa.
-   [ ] Tối ưu structure.
-   [ ] Responsive improvement.
-   [ ] Performance improvement.

### TV2 --- Mobile

-   [ ] Refactor Mobile.
-   [ ] Component hóa.
-   [ ] Tối ưu navigation.
-   [ ] Responsive improvement.
-   [ ] Performance improvement.

### TV3 --- Architecture

-   [ ] Refactor architecture.
-   [ ] Kiểm tra folder structure.
-   [ ] Code Review.
-   [ ] Kiểm tra coding convention.
-   [ ] Chuẩn hóa Git workflow.

### Deliverable

-   [ ] Clean code.
-   [ ] Architecture ổn định.
-   [ ] Không có technical debt nghiêm trọng.

------------------------------------------------------------------------

# TUẦN 9 --- Testing

## Mục tiêu

Xây dựng và hoàn thiện chiến lược kiểm thử.

### Testing pipeline

``` text
Unit Test
    ↓
Component Test
    ↓
Integration Test
    ↓
Manual Test
```

### TV1

-   [ ] Unit/Component test Web.
-   [ ] Integration test Web.
-   [ ] Manual test Web.
-   [ ] Fix Web bugs.

### TV2

-   [ ] Component test Mobile.
-   [ ] Integration test Mobile.
-   [ ] Manual test Mobile.
-   [ ] Fix Mobile bugs.

### TV3

-   [ ] Xây dựng Testing Strategy.
-   [ ] Theo dõi test coverage nếu phù hợp.
-   [ ] Tích hợp test vào CI.
-   [ ] Kiểm tra kết quả CI.

### Deliverable

-   [ ] Test cases.
-   [ ] Test results.
-   [ ] CI chạy test tự động.

------------------------------------------------------------------------

# TUẦN 10 --- CI/CD

## Mục tiêu

Hoàn thiện yêu cầu **Continuous Integration / Continuous Delivery**.

## CI

Khi Push/Pull Request:

``` text
Push / Pull Request
        ↓
Install dependencies
        ↓
Lint
        ↓
Test
        ↓
Build
        ↓
PASS / FAIL
```

### Checklist CI

-   [ ] GitHub Actions workflow.
-   [ ] Install dependencies.
-   [ ] Lint.
-   [ ] Test.
-   [ ] Build.
-   [ ] Kiểm tra Pull Request.
-   [ ] CI pass.

## CD

``` text
GitHub
   ↓
main
   ↓
CI
   ↓
Build
   ↓
Deploy
   ↓
Web Production
```

### Checklist CD

-   [ ] Thiết lập build production.
-   [ ] Thiết lập deployment Web.
-   [ ] Kiểm tra deployment.
-   [ ] Kiểm tra rollback/redeploy nếu phù hợp.
-   [ ] Mobile build pipeline nếu sử dụng Expo hoặc công cụ tương ứng.
-   [ ] Documentation cho CI/CD.

### Deliverable

-   [ ] CI hoạt động thật.
-   [ ] CD hoạt động thật.
-   [ ] Production Web.
-   [ ] Build Mobile.
-   [ ] Documentation CI/CD.

------------------------------------------------------------------------

# TUẦN 11 --- Final Integration

## Mục tiêu

Đóng băng tính năng và tập trung vào chất lượng cuối kỳ.

### Không nên

-   [ ] Không thêm feature lớn mới nếu không cần thiết.
-   [ ] Không thay đổi toàn bộ architecture.
-   [ ] Không viết lại project từ đầu.

### Nên tập trung

-   [ ] Fix bugs.
-   [ ] UI polishing.
-   [ ] Responsive testing.
-   [ ] Web testing.
-   [ ] Mobile testing.
-   [ ] CI/CD testing.
-   [ ] Production build.
-   [ ] README.
-   [ ] Documentation.
-   [ ] Final report.
-   [ ] Chuẩn bị demo.

### TV1

-   [ ] Final Web.
-   [ ] Build Web.
-   [ ] Screenshot.
-   [ ] Technical documentation Web.

### TV2

-   [ ] Final Mobile.
-   [ ] Build Mobile.
-   [ ] Screenshot.
-   [ ] Technical documentation Mobile.

### TV3

-   [ ] Final CI/CD.
-   [ ] Architecture documentation.
-   [ ] GitHub cleanup.
-   [ ] Final README.
-   [ ] Final integration.
-   [ ] Final report.

------------------------------------------------------------------------

# TUẦN 12 --- NỘP ĐỒ ÁN CUỐI KỲ

## Mục tiêu

Hoàn tất sản phẩm, báo cáo và demo.

### Final checklist

#### Sản phẩm

-   [ ] Web App hoàn chỉnh.
-   [ ] Mobile App hoàn chỉnh.
-   [ ] UI/UX hoàn chỉnh.
-   [ ] Responsive.
-   [ ] Core features hoạt động.
-   [ ] Error handling.
-   [ ] Loading states.
-   [ ] Validation.
-   [ ] Testing.

#### GitHub

-   [ ] Repository sạch.
-   [ ] Branch rõ ràng.
-   [ ] Commit history rõ ràng.
-   [ ] Issues cập nhật.
-   [ ] Pull Requests.
-   [ ] Code Review.
-   [ ] CI pass.
-   [ ] CD hoạt động.
-   [ ] README hoàn chỉnh.

#### Documentation

-   [ ] Problem description.
-   [ ] Requirements.
-   [ ] UI/UX.
-   [ ] Architecture.
-   [ ] Technology stack.
-   [ ] Git workflow.
-   [ ] Testing.
-   [ ] CI/CD.
-   [ ] Installation guide.
-   [ ] Usage guide.
-   [ ] Screenshots.
-   [ ] Limitations.
-   [ ] Future development.

#### Báo cáo

-   [ ] Hoàn thiện báo cáo cuối kỳ.
-   [ ] Kiểm tra nội dung.
-   [ ] Kiểm tra hình ảnh.
-   [ ] Kiểm tra tài liệu tham khảo nếu có.
-   [ ] Kiểm tra phân công thành viên.
-   [ ] Kiểm tra tiến độ 12 tuần.
-   [ ] Kiểm tra lỗi chính tả.
-   [ ] Chuẩn bị file nộp.

#### Demo

-   [ ] Demo Web.
-   [ ] Demo Mobile.
-   [ ] Demo CI/CD.
-   [ ] Trình bày Architecture.
-   [ ] Trình bày Git workflow.
-   [ ] Trình bày Testing.
-   [ ] Chuẩn bị phương án dự phòng khi demo.

------------------------------------------------------------------------

# 6. Milestones GitHub

## M1 --- Project Setup

**Deadline: Tuần 1**

-   [ ] Requirement.
-   [ ] Repository.
-   [ ] Git workflow.
-   [ ] Project structure.
-   [ ] Issue list.

## M2 --- UI/UX & Architecture

**Deadline: Tuần 2**

-   [ ] Figma.
-   [ ] Architecture.
-   [ ] Design System.
-   [ ] Web skeleton.
-   [ ] Mobile skeleton.

## M3 --- MVP

**Deadline: Tuần 6**

-   [ ] Web.
-   [ ] Mobile.
-   [ ] Core features.
-   [ ] Integration.
-   [ ] Testing.
-   [ ] CI.

## M4 --- Midterm

**Deadline: Tuần 7**

-   [ ] MVP Demo.
-   [ ] Midterm report.
-   [ ] GitHub.
-   [ ] CI.
-   [ ] Testing.

## M5 --- Final

**Deadline: Tuần 12**

-   [ ] Web.
-   [ ] Mobile.
-   [ ] CI/CD.
-   [ ] Testing.
-   [ ] Documentation.
-   [ ] Final report.
-   [ ] Final demo.

------------------------------------------------------------------------

# 7. Weekly Team Workflow

Mỗi tuần thực hiện chu kỳ:

``` text
THỨ 2
Planning
↓
Phân task

THỨ 3–5
Development

THỨ 6
Push GitHub

THỨ 7
Code Review + Integration

CHỦ NHẬT
Demo nội bộ + Update report
```

### Cuối mỗi tuần

-   [ ] Cập nhật Issues.
-   [ ] Cập nhật Milestone.
-   [ ] Push code.
-   [ ] Review Pull Requests.
-   [ ] Merge code.
-   [ ] Chạy test.
-   [ ] Kiểm tra CI.
-   [ ] Ghi lại kết quả.
-   [ ] Cập nhật báo cáo.

------------------------------------------------------------------------

# 8. Definition of Done

Một feature chỉ được xem là **Done** khi:

-   [ ] Code hoàn thành.
-   [ ] UI hoàn chỉnh.
-   [ ] Responsive.
-   [ ] Validation nếu cần.
-   [ ] Loading state.
-   [ ] Error state.
-   [ ] Đã test.
-   [ ] Code Review.
-   [ ] Pull Request được merge.
-   [ ] CI pass.
-   [ ] Không còn lỗi nghiêm trọng.
-   [ ] Documentation được cập nhật nếu cần.

------------------------------------------------------------------------

# 9. Tiến độ mục tiêu

  Hạng mục            W2     W4     W6     W7     W9    W10    W11    W12
  --------------- ------ ------ ------ ------ ------ ------ ------ ------
  Requirements      100%   100%   100%   100%   100%   100%   100%   100%
  UI/UX             100%   100%   100%   100%   100%   100%   100%   100%
  Web                20%    50%    80%    80%    90%    95%   100%   100%
  Mobile             20%    50%    80%    80%    90%    95%   100%   100%
  Architecture      100%    80%    90%    90%   100%   100%   100%   100%
  CI                 20%    50%    80%    80%    90%   100%   100%   100%
  CD                  0%     0%    20%    30%    50%   100%   100%   100%
  Testing             0%    30%    60%    60%    90%    90%   100%   100%
  Documentation      20%    30%    50%    70%    80%    90%   100%   100%

------------------------------------------------------------------------

# 10. Các mốc quan trọng nhất

``` text
W1
│
├── Requirement
├── GitHub
└── Project Setup
        ↓
W2
│
├── Figma
├── UI/UX
└── Architecture
        ↓
W3–W5
│
└── Development
        ↓
W6
│
└── Integration + Testing
        ↓
W7
│
└── ⭐ MIDTERM MVP
        ↓
W8–W9
│
└── Refactor + Testing
        ↓
W10
│
└── ⭐ CI/CD
        ↓
W11
│
└── Final Integration
        ↓
W12
│
└── ⭐ FINAL SUBMISSION
```

------------------------------------------------------------------------

# 11. Nguyên tắc quan trọng của nhóm

-   [ ] Code phải được push thường xuyên.
-   [ ] Không để một thành viên giữ code riêng quá lâu.
-   [ ] Mọi thành viên đều phải hiểu architecture tổng thể.
-   [ ] Không chỉ làm giao diện; phải thể hiện quy trình Software
    Engineering.
-   [ ] GitHub phải thể hiện được quá trình phát triển.
-   [ ] CI/CD phải chạy thật.
-   [ ] Testing phải được thực hiện trước khi merge.
-   [ ] Tuần 7 phải có MVP.
-   [ ] Sau tuần 7 ưu tiên chất lượng hơn việc thêm feature.
-   [ ] Tuần 11 đóng băng tính năng.
-   [ ] Tuần 12 chỉ tập trung hoàn thiện, nộp và demo.

------------------------------------------------------------------------

# 12. Definition of Success

## Đến tuần 7

> Nhóm có một **MVP Web + Mobile chạy được**, giao diện theo thiết kế,
> chức năng cốt lõi hoạt động, có GitHub workflow, CI và có thể demo cho
> giảng viên.

## Đến tuần 12

> Nhóm có **Frontend Web React.js + Mobile React Native hoàn chỉnh**,
> giao diện chuyên nghiệp, có testing, Git/GitHub workflow, CI/CD hoạt
> động, documentation đầy đủ và sẵn sàng demo/nộp đồ án.
