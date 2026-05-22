# 지역별 superadmin 마이그레이션

## 모델 변경

- **이전**: `is_superadmin=1` 이면 모든 지역 접근
- **이후**: `is_superadmin=1` 은 **해당 `tenant_id` 한 지역**만. 지역당 1명 권장

## DB 수동 작업 (예시)

```sql
-- 글로벌 superadmin 이 여러 tenant 에 행이 없다면, 담당 지역 하나에만 남기기
-- UPDATE admin SET is_superadmin = 0 WHERE username = '...' AND tenant_id <> ?;

-- 지역당 superadmin 1명 확인
SELECT tenant_id, COUNT(*) AS n FROM admin WHERE is_superadmin = 1 GROUP BY tenant_id HAVING n > 1;
```

## 앱 동작

- 일반 관리자: 꼬리달기·참여·방송 등 운영
- superadmin: 위 + **관리자 CRUD**, **지역 활동 로그**, **텔레그램 채팅방 설정**
