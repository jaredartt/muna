// Remembers the message you were typing to Muna (but have not sent), on THIS phone only.
// It lives in the browser's own storage, not in Supabase, so it costs nothing there and never leaves the device.
const key = (userId: string | undefined) => `muna-chat-draft:${userId ?? 'anon'}`

export function loadDraft(userId: string | undefined): string {
  try {
    return localStorage.getItem(key(userId)) ?? ''
  } catch {
    return ''
  }
}

export function saveDraft(userId: string | undefined, text: string) {
  try {
    if (text) localStorage.setItem(key(userId), text)
    else localStorage.removeItem(key(userId))
  } catch {
    /* storage can be blocked (private mode): the draft simply is not kept */
  }
}
