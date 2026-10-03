// Which white blocks the Home screen shows and where (two columns). You change it by pressing and holding a block and dragging it.
// It is saved on your profile (so every device of yours looks the same) and kept on the device for an instant first paint.
export type BlockId = 'tasks' | 'sleep' | 'hobbies' | 'uni' | 'gym' | 'calories'
export const ALL_BLOCKS: BlockId[] = ['tasks', 'sleep', 'hobbies', 'uni', 'gym', 'calories']
export const DEFAULT_LAYOUT: BlockId[][] = [
  ['tasks', 'sleep', 'hobbies'],
  ['uni', 'gym', 'calories'],
]
const KEY = 'muna.homeLayout.v1'

/** Takes whatever was saved and makes a safe layout: unknown or double blocks dropped, new blocks added to the shorter column. */
export function normalizeLayout(raw: unknown): BlockId[][] {
  const seen = new Set<BlockId>()
  const cols: BlockId[][] = [[], []]
  if (Array.isArray(raw)) {
    raw.slice(0, 2).forEach((c, i) => {
      if (!Array.isArray(c)) return
      for (const id of c) if (typeof id === 'string' && (ALL_BLOCKS as string[]).includes(id) && !seen.has(id as BlockId)) {
        seen.add(id as BlockId)
        cols[i].push(id as BlockId)
      }
    })
  }
  // nothing saved yet: the default; blocks that are new since it was saved go where there is most room
  if (!seen.size) return DEFAULT_LAYOUT.map((c) => [...c])
  for (const id of DEFAULT_LAYOUT.flat()) if (!seen.has(id)) (cols[0].length <= cols[1].length ? cols[0] : cols[1]).push(id)
  return cols
}

export function readLocalLayout(): BlockId[][] | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? normalizeLayout(JSON.parse(raw)) : null
  } catch {
    return null
  }
}
export function writeLocalLayout(l: BlockId[][]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(l))
  } catch {
    /* fine */
  }
}
