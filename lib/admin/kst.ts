// 어드민 통계 공용 — 날짜 버킷은 전부 KST 기준
export const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** UTC ISO → KST 기준 YYYY-MM-DD */
export function kstDayKey(iso: string): string {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().split("T")[0]
}

/** 오늘(KST)까지 최근 n일의 날짜 키 배열 */
export function kstDayKeys(days: number): string[] {
  const todayKst = new Date(Date.now() + KST_OFFSET_MS)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(todayKst.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000)
    return d.toISOString().split("T")[0]
  })
}
