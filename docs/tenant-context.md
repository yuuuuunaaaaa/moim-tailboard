# 소속(테넌트) 컨텍스트

- **참여 소속**: `/` 목록 + `allowed_tenant_slug` 쿠키 → `/t/{slug}/events`
- **관리 소속**: `/admin` choose 화면에서만 변경 (`?tenant=` 확정). admin 하위 URL에서는 in-place 전환 없음.

복수 소속 관리자는 admin 레이아웃 상단 **「소속 변경」** 으로 `/admin`(choose)만 이동한다.
