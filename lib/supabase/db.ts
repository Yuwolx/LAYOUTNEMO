/**
 * Supabase 데이터 접근 레이어.
 *
 * 앱 타입(WorkBlock, Zone, Canvas) ↔ Supabase 행 변환 + CRUD 담당.
 * 호출 측은 항상 supabase client null 체크 후 사용할 것.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { WorkBlock, Zone, Canvas } from "@/types"

// ─────────────────────────────────────────────
// Row 타입 (Supabase 컬럼과 1:1)
// ─────────────────────────────────────────────

type CanvasRow = {
  id: string
  user_id: string
  name: string
  position: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

type ZoneRow = {
  id: string
  canvas_id: string
  user_id: string
  label: string
  color: string
  position: number
}

type BlockRow = {
  id: string
  canvas_id: string
  user_id: string
  zone_id: string | null
  title: string
  description: string | null
  notes: string | null
  x: number
  y: number
  width: number
  height: number
  urgency: string
  due_date: string | null
  url: string | null
  related_to: string[]
  is_guide: boolean
  is_completed: boolean
  is_deleted: boolean
  deleted_at: string | null
  metadata: Record<string, unknown>
}

// ─────────────────────────────────────────────
// 변환 함수
// ─────────────────────────────────────────────

function throwIfSupabaseError(error: { message: string } | null, action: string): void {
  if (error) {
    throw new Error(`${action}: ${error.message}`)
  }
}

function blockToRow(block: WorkBlock, canvasId: string, userId: string): BlockRow {
  return {
    id: block.id,
    canvas_id: canvasId,
    user_id: userId,
    zone_id: block.zone || null,
    title: block.title,
    description: block.description || null,
    notes: block.detailedNotes || null,
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    urgency: block.urgency ?? "thinking",
    due_date: block.dueDate || null,
    url: block.url || null,
    related_to: block.relatedTo ?? [],
    is_guide: block.isGuide ?? false,
    is_completed: block.isCompleted ?? false,
    is_deleted: block.isDeleted ?? false,
    deleted_at: block.deletedAt ? new Date(block.deletedAt).toISOString() : null,
    // 대표(공지) 블럭 여부는 별도 컬럼 없이 metadata 에 저장 → 마이그레이션 없이 기기 간 동기화.
    metadata: { pinned: block.isPinned ?? false },
  }
}

function rowToBlock(row: BlockRow): WorkBlock {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    zone: row.zone_id ?? "",
    urgency: row.urgency as WorkBlock["urgency"],
    dueDate: row.due_date ?? undefined,
    url: row.url ?? undefined,
    relatedTo: row.related_to ?? [],
    detailedNotes: row.notes ?? undefined,
    isGuide: row.is_guide,
    isCompleted: row.is_completed,
    isDeleted: row.is_deleted,
    deletedAt: row.deleted_at ? new Date(row.deleted_at).getTime() : undefined,
    isPinned: Boolean((row.metadata as { pinned?: boolean } | null)?.pinned),
  }
}

function zoneToRow(zone: Zone, canvasId: string, userId: string, position: number): ZoneRow {
  return {
    id: zone.id,
    canvas_id: canvasId,
    user_id: userId,
    label: zone.label,
    color: zone.color,
    position,
  }
}

function rowToZone(row: ZoneRow): Zone {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
  }
}

// ─────────────────────────────────────────────
// 유저 프로필
// ─────────────────────────────────────────────

export async function getUserProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .single()
  if (error) throw error
  return data
}

// ─────────────────────────────────────────────
// 캔버스 전체 로드
// ─────────────────────────────────────────────

export async function loadUserCanvases(
  supabase: SupabaseClient,
  userId: string,
): Promise<Canvas[]> {
  const [{ data: canvasRows, error: ce }, { data: zoneRows, error: ze }, { data: blockRows, error: be }] =
    await Promise.all([
      supabase.from("canvases").select("*").eq("user_id", userId).order("position"),
      supabase.from("zones").select("*").eq("user_id", userId).order("position"),
      supabase.from("blocks").select("*").eq("user_id", userId),
    ])

  if (ce) throw ce
  if (ze) throw ze
  if (be) throw be

  // tombstone(삭제된) 캔버스는 노출하지 않는다 — deleteCanvas 참고.
  const aliveCanvasRows = (canvasRows as CanvasRow[]).filter(
    (c) => !(c.metadata as { deleted?: boolean } | null)?.deleted,
  )

  return aliveCanvasRows.map((c) => ({
    id: c.id,
    name: c.name,
    createdAt: new Date(c.created_at).getTime(),
    updatedAt: new Date(c.updated_at).getTime(),
    zones: (zoneRows as ZoneRow[]).filter((z) => z.canvas_id === c.id).map(rowToZone),
    blocks: (blockRows as BlockRow[]).filter((b) => b.canvas_id === c.id).map(rowToBlock),
  }))
}

// ─────────────────────────────────────────────
// 캔버스 저장 (upsert)
// ─────────────────────────────────────────────

export async function saveCanvas(
  supabase: SupabaseClient,
  userId: string,
  canvas: Canvas,
  position: number,
): Promise<void> {
  // 1. canvas row
  const { error: canvasError } = await supabase.from("canvases").upsert({
    id: canvas.id,
    user_id: userId,
    name: canvas.name,
    position,
    updated_at: new Date().toISOString(),
  })
  throwIfSupabaseError(canvasError, "Failed to save canvas")

  // 2. zones — upsert 만 한다.
  //    blocks 와 같은 이유로 스냅샷 pruning(현재 스냅샷에 없는 결 삭제)을 하지 않는다.
  //    오래된 탭/기기의 저장이 다른 기기에서 방금 만든 결을 지울 수 있기 때문이다.
  //    실제 삭제는 사용자가 결을 지울 때 deleteZones() 로만 일어난다.
  const zoneRows = canvas.zones.map((z, i) => zoneToRow(z, canvas.id, userId, i))
  if (zoneRows.length > 0) {
    const { error } = await supabase.from("zones").upsert(zoneRows)
    throwIfSupabaseError(error, "Failed to save zones")
  }

  // 3. blocks — upsert (is_deleted 포함)
  // 삭제는 saveCanvas의 스냅샷 pruning에 맡기지 않는다.
  // 오래된 탭/기기의 저장이 다른 기기에서 새로 만든 블록을 지울 수 있기 때문이다.
  const blockRows = canvas.blocks.map((b) => blockToRow(b, canvas.id, userId))
  if (blockRows.length > 0) {
    const { error } = await supabase.from("blocks").upsert(blockRows)
    throwIfSupabaseError(error, "Failed to save blocks")
  }
}

// ─────────────────────────────────────────────
// 캔버스 삭제
// ─────────────────────────────────────────────

export async function deleteBlocks(supabase: SupabaseClient, blockIds: string[]): Promise<void> {
  if (blockIds.length === 0) return

  const { error } = await supabase.from("blocks").delete().in("id", blockIds)
  throwIfSupabaseError(error, "Failed to delete blocks")
}

// 사용자가 결을 삭제할 때만 명시적으로 호출. saveCanvas 는 결을 지우지 않는다.
// blocks.zone_id 는 on delete set null 이라 해당 결의 블럭은 삭제되지 않고 결만 사라진다.
export async function deleteZones(supabase: SupabaseClient, zoneIds: string[]): Promise<void> {
  if (zoneIds.length === 0) return

  const { error } = await supabase.from("zones").delete().in("id", zoneIds)
  throwIfSupabaseError(error, "Failed to delete zones")
}

// 캔버스 삭제 = tombstone (hard delete 아님).
// 행을 지우면 다른 기기의 autosave 가 로컬에 남아 있던 캔버스를 통째로 upsert 해 부활시킨다.
// metadata.deleted 마킹은 saveCanvas 가 metadata 컬럼을 건드리지 않으므로 오래된 기기의
// 저장에도 살아남고, loadUserCanvases 가 걸러낸다. (관례: 컬럼 추가 없이 metadata 로 동기화)
// tombstone 행과 그 아래 blocks/zones 는 남지만 어디에도 노출되지 않는다.
export async function deleteCanvas(supabase: SupabaseClient, canvasId: string): Promise<void> {
  const { error } = await supabase
    .from("canvases")
    .update({ metadata: { deleted: true, deleted_at: new Date().toISOString() } })
    .eq("id", canvasId)
  throwIfSupabaseError(error, "Failed to delete canvas")
}

export async function resetUserCanvases(supabase: SupabaseClient, userId: string): Promise<void> {
  // 초기화도 tombstone — hard delete 하면 다른 기기가 옛 캔버스를 되살릴 수 있다.
  const { error } = await supabase
    .from("canvases")
    .update({ metadata: { deleted: true, deleted_at: new Date().toISOString() } })
    .eq("user_id", userId)
  throwIfSupabaseError(error, "Failed to reset canvases")
}

// ─────────────────────────────────────────────
// localStorage → Supabase 최초 마이그레이션
//
// 기존 ID가 UUID가 아닐 수 있으므로:
// 1. 각 엔티티에 새 UUID 발급
// 2. 참조(block.zone, block.relatedTo) 도 매핑
// 3. 업데이트된 Canvas[] 반환 → 호출 측이 localStorage 도 덮어씀
// ─────────────────────────────────────────────

export async function migrateLocalToSupabase(
  supabase: SupabaseClient,
  userId: string,
  localCanvases: Canvas[],
): Promise<Canvas[]> {
  const isUUID = (id: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

  // 로컬 캔버스 id 가 원격에 tombstone(metadata.deleted) 행으로 이미 존재하면 새 UUID 를
  // 발급한다. saveCanvas 는 metadata 를 건드리지 않으므로(tombstone 생존 조건) 같은 id 로
  // upsert 하면 deleted=true 가 남아 — 이 기기에선 보이는데 클라우드에선 영구히 안 보이는
  // 캔버스가 된다 (초기화한 계정에 옛 기기가 재로그인하는 시나리오).
  const localIds = localCanvases.map((c) => c.id).filter(isUUID)
  const tombstonedIds = new Set<string>()
  if (localIds.length > 0) {
    const { data } = await supabase.from("canvases").select("id, metadata").in("id", localIds)
    for (const row of (data ?? []) as Array<{ id: string; metadata: { deleted?: boolean } | null }>) {
      if (row.metadata?.deleted) tombstonedIds.add(row.id)
    }
  }

  const migrated: Canvas[] = localCanvases.map((canvas) => {
    const canvasId = isUUID(canvas.id) && !tombstonedIds.has(canvas.id) ? canvas.id : crypto.randomUUID()

    // zone ID 매핑
    const zoneIdMap = new Map<string, string>()
    const newZones: Zone[] = canvas.zones.map((z) => {
      const newId = isUUID(z.id) ? z.id : crypto.randomUUID()
      zoneIdMap.set(z.id, newId)
      return { ...z, id: newId }
    })

    // block ID 매핑
    const blockIdMap = new Map<string, string>()
    canvas.blocks.forEach((b) => {
      const newId = isUUID(b.id) ? b.id : crypto.randomUUID()
      blockIdMap.set(b.id, newId)
    })

    const newBlocks: WorkBlock[] = canvas.blocks.map((b) => ({
      ...b,
      id: blockIdMap.get(b.id)!,
      zone: zoneIdMap.get(b.zone) ?? b.zone,
      relatedTo: (b.relatedTo ?? []).map((rid) => blockIdMap.get(rid) ?? rid),
    }))

    return {
      ...canvas,
      id: canvasId,
      zones: newZones,
      blocks: newBlocks,
    }
  })

  // Supabase에 저장
  await Promise.all(
    migrated.map((canvas, i) => saveCanvas(supabase, userId, canvas, i)),
  )

  return migrated
}
