/**
 * 플랜별 한도 단일 소스.
 *
 * 유료화 로드맵: pro 플랜은 AI 사용량 상향 + 정리하기 AI + 캔버스 무제한.
 * AI 월 한도는 lib/ai/quota.ts (서버 강제), 캔버스 개수는 여기 (클라이언트 강제).
 * 마스터 계정(lib/constants/master.ts)은 모든 한도를 우회한다.
 */
export const FREE_CANVAS_LIMIT = 1
