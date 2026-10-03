// Which white blocks the Home screen shows and where (two columns). You change it by pressing and holding a block and dragging it.
// It is saved on YOUR OWN profile (each person arranges their own Home; every device of yours looks the same) and kept on the device for an instant first paint.
export type BlockId = 'tasks' | 'sleep' | 'hobbies' | 'uni' | 'gym' | 'calories' | 'weather'
export const ALL_BLOCKS: BlockId[] = ['tasks', 'sleep', 'hobbies', 'uni', 'gym', 'calories', 'weather']
export const DEFAULT_LAYOUT: BlockId[][] = [
  ['tasks', 'sleep', 'hobbies'],
  ['uni', 'gym', 'calories', 'weather'],
]
// one saved copy PER PERSON (so two people using the same browser never see each other's layout)
const key = (uid: string) => `muna.homeLayout.v2.${uid}`

/** Takes whatever was saved and makes a safe layout: unknown or double blocks dropped, new blocks added to the shorter column. */
export function normalizeLayout(raw: unknown): BlockId[][] {
  const seen = new Set<BlockId>()
  const cols: BlockId[][] = [[], []]
  if (Array.isArray(raw)) {
    // (older saves had a third "wide strip" with Weather: its blocks now go to the shorter column)
    raw.slice(0, 3).forEach((c, i) => {
      if (!Array.isArray(c)) return
      for (const id of c) if (typeof id === 'string' && (ALL_BLOCKS as string[]).includes(id) && !seen.has(id as BlockId)) {
        seen.add(id as BlockId)
        const col = i < 2 ? cols[i] : cols[0].length <= cols[1].length ? cols[0] : cols[1]
        col.push(id as BlockId)
      }
    })
  }
  // nothing saved yet: the default; blocks that are new since it was saved go where there is most room
  if (!seen.size) return DEFAULT_LAYOUT.map((c) => [...c])
  for (const id of DEFAULT_LAYOUT.flat()) {
    if (seen.has(id)) continue
    ;(cols[0].length <= cols[1].length ? cols[0] : cols[1]).push(id)
  }
  return cols
}

export function readLocalLayout(uid: string | undefined): BlockId[][] | null {
  if (!uid) return null
  try {
    const raw = localStorage.getItem(key(uid))
    return raw ? normalizeLayout(JSON.parse(raw)) : null
  } catch {
    return null
  }
}
export function writeLocalLayout(uid: string | undefined, l: BlockId[][]) {
  if (!uid) return
  try {
    localStorage.setItem(key(uid), JSON.stringify(l))
  } catch {
    /* fine */
  }
}
