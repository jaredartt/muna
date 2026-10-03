// Who a task belongs to decides its colour: Jared orange, Lidia purple, both of you green.
// The two are told apart by their profile name; if a name is something else, you are orange and your partner purple.

export const BOTH_COLOR = 'mint' // green
const JARED = 'peach' // orange
const LIDIA = 'lilac' // purple

type Person = { id: string; display_name?: string | null }

export function memberColor(m: Person, myId: string): string {
  const n = (m.display_name ?? '').trim().toLowerCase()
  if (n.startsWith('jared')) return JARED
  if (n.startsWith('lidia')) return LIDIA
  return m.id === myId ? JARED : LIDIA
}

/** The colour for a task given who it is for (null / '' = both of you). */
export function assigneeColor(assigneeId: string | null | undefined, members: Person[], myId: string): string {
  if (!assigneeId) return BOTH_COLOR
  return memberColor(members.find((m) => m.id === assigneeId) ?? { id: assigneeId }, myId)
}

/** Jared first, then Lidia, then anyone else; so the list reads the same on both phones. */
export function sortMembers<T extends Person>(members: T[]): T[] {
  const rank = (m: T) => {
    const n = (m.display_name ?? '').trim().toLowerCase()
    return n.startsWith('jared') ? 0 : n.startsWith('lidia') ? 1 : 2
  }
  return [...members].sort((a, b) => rank(a) - rank(b))
}
