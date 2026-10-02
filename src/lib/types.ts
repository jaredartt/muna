import type { Repeat } from './recurrence'

export type ThemePref = 'light' | 'dark' | 'system'

export type Profile = {
  id: string
  household_id: string
  display_name: string
  avatar: string // a Tabler icon component name, e.g. "IconPawFilled"
  avatar_color: string // mint | peach | lilac | sky | butter | rose
  theme_pref: ThemePref
}

export type Member = Pick<Profile, 'id' | 'display_name' | 'avatar' | 'avatar_color'>

export type Task = {
  id: string
  household_id: string
  created_by: string
  assigned_to: string | null
  title: string
  notes: string
  due_date: string | null // YYYY-MM-DD
  start_time: string | null // HH:MM:SS
  end_time: string | null
  icon: string // a Muna icon key ("pizza") or a Tabler component name ("IconBeerFilled")
  color: string
  completed: boolean
  completed_at: string | null
  created_at: string
  sync_google: boolean
  google_event_id: string | null
  google_owner: string | null
  repeat: Repeat | null // null = happens once
}

/** One day of a repeating task (looks like a Task, with that day's date and tick). `series` is the real task. */
export type Occurrence = Task & { series?: Task }

export type TaskDraft = Partial<Omit<Task, 'id' | 'household_id' | 'created_at' | 'google_event_id' | 'google_owner'>> & { title: string }

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
