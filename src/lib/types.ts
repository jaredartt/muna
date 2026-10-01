export type ThemePref = 'light' | 'dark' | 'system'

export type Profile = {
  id: string
  household_id: string
  display_name: string
  avatar: string
  theme_pref: ThemePref
  muna_personality: string
}

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
  icon: string
  color: string
  completed: boolean
  completed_at: string | null
  created_at: string
}

export type TaskDraft = Partial<Omit<Task, 'id' | 'household_id' | 'created_at'>> & { title: string }

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
