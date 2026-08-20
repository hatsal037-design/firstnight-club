# send-push Edge Function (기록)

배포: MCP `deploy_edge_function` (2026-08-20, verify_jwt 켬).
소스는 Supabase 대시보드 > Edge Functions > send-push 에서 확인.

- 입력: `{ message_id }` — 로그인 사용자의 JWT 필요
- 수신자 계산: 공지 → 전체 구독자 / 회원 문의 → 운영진 / 쪽지·시스템 → 당사자
- 발신자 본인에게는 안 보냄. 410 Gone 구독은 지운다
- 비밀: VAPID_PUBLIC_KEY · VAPID_PRIVATE_KEY · VAPID_SUBJECT (secrets set 으로 등록)
- VAPID 키 원본: `~/.config/tunel_vapid.json` (로컬 전용 — 저장소에 안 넣음)
