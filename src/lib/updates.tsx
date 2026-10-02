import type { ComponentType } from 'react'
import {
  IconBoltFilled,
  IconCalendarFilled,
  IconHeartFilled,
  IconHomeFilled,
  IconLockFilled,
  IconMessageCircleFilled,
  IconMicrophoneFilled,
  IconMoonFilled,
  IconPaletteFilled,
  IconPawFilled,
  IconShieldFilled,
  IconTimelineEventFilled,
} from '@tabler/icons-react'

export type UpdateEntry = {
  date: string // YYYY-MM-DD
  title: string
  text: string // one or two short sentences, simple words
  Icon: ComponentType<{ size?: number }>
  color: 'mint' | 'peach' | 'lilac' | 'sky' | 'butter' | 'rose'
}

// Newest first. Add one entry here for every change we make (see "Working agreements" in project_status.md).
export const UPDATES: UpdateEntry[] = [
  { date: '2026-10-02', title: 'Scroll fix', text: 'The chat now really opens on the latest message, and every other page (like this log) opens at the top.', Icon: IconBoltFilled, color: 'sky' },
  { date: '2026-10-02', title: 'Chat opens at the end', text: 'When you open the chat, you land on the latest message, like WhatsApp.', Icon: IconMessageCircleFilled, color: 'sky' },
  { date: '2026-10-02', title: 'Update log', text: 'This list! Every change we make to Muna will show up here.', Icon: IconTimelineEventFilled, color: 'sky' },
  { date: '2026-10-02', title: 'Cat and dog icons', text: 'The icon search now finds every Tabler icon, filled and outline mixed, so cat, dog and many more are there.', Icon: IconPawFilled, color: 'peach' },
  { date: '2026-10-02', title: 'Menu animation', text: 'The icon now glides up when its dot appears, and back down when it leaves.', Icon: IconHomeFilled, color: 'lilac' },
  { date: '2026-10-02', title: 'Message kept', text: 'What you are typing to Muna stays when you switch tabs or close the app.', Icon: IconMessageCircleFilled, color: 'mint' },
  { date: '2026-10-02', title: 'Shared personality', text: 'You both see and edit the same personality text for Muna.', Icon: IconHeartFilled, color: 'rose' },
  { date: '2026-10-02', title: 'Muna gets tired', text: 'When the daily limit is used up she says she is tired and asks to continue tomorrow.', Icon: IconMoonFilled, color: 'butter' },
  { date: '2026-10-02', title: 'No token limit', text: 'Removed the 1,000,000 limit. Profile just counts how many tokens were used.', Icon: IconBoltFilled, color: 'butter' },
  { date: '2026-10-01', title: 'Colors and icons', text: 'Everything uses filled icons. Pick your own color and icon, with a search bar.', Icon: IconPaletteFilled, color: 'peach' },
  { date: '2026-10-01', title: 'Voice notes', text: 'Tap the microphone, talk, and send. Muna listens to the whole message.', Icon: IconMicrophoneFilled, color: 'rose' },
  { date: '2026-10-01', title: 'Google Calendar', text: 'Your calendars connect both ways, and you see each other’s events.', Icon: IconCalendarFilled, color: 'sky' },
  { date: '2026-10-01', title: 'Google app published', text: 'The Google connection no longer expires after a week.', Icon: IconShieldFilled, color: 'mint' },
  { date: '2026-10-01', title: 'Muna counts tokens', text: 'Profile shows how much energy Muna has used this month.', Icon: IconBoltFilled, color: 'butter' },
  { date: '2026-10-01', title: 'Private for two', text: 'Sign in with Google. Only you and Lidia can get in, and you share one home.', Icon: IconLockFilled, color: 'lilac' },
  { date: '2026-10-01', title: 'First version', text: 'Home, Calendar, Chat with Muna and Profile. Muna can add and change tasks for you.', Icon: IconMessageCircleFilled, color: 'mint' },
]
