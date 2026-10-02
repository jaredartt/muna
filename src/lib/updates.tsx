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
  IconPizzaFilled,
  IconPawFilled,
  IconRepeat,
  IconShieldFilled,
  IconTimelineEventFilled,
} from '@tabler/icons-react'

export type UpdateEntry = {
  date: string // YYYY-MM-DD
  time?: string // HH:MM (Berlin time); older entries from before we tracked it have none
  title: string
  text: string // one or two short sentences, simple words
  Icon: ComponentType<{ size?: number }>
  color: 'mint' | 'peach' | 'lilac' | 'sky' | 'butter' | 'rose'
}

// Newest first. Add one entry here for every change we make (see "Working agreements" in project_status.md).
export const UPDATES: UpdateEntry[] = [
  { date: '2026-10-02', time: '14:04', title: 'Scrolling really fixed', text: 'The real cause of the stuck scrolling on trackpad and iPhone was one line of page styling. It is fixed now.', Icon: IconShieldFilled, color: 'mint' },
  { date: '2026-10-02', time: '13:57', title: 'Scrolling fixed', text: 'Scrolling could get stuck on the iPhone. I removed the page lock that I added for the task sheets and replaced it with a gentler one that only blocks the page behind an open sheet.', Icon: IconShieldFilled, color: 'peach' },
  { date: '2026-10-02', time: '12:25', title: '06:00 and 00:00 are back', text: 'The first and last hour labels are shown again, and the new breathing space above and below stays.', Icon: IconCalendarFilled, color: 'butter' },
  { date: '2026-10-02', time: '12:22', title: 'Drag up scrolls too', text: 'When you drag a task towards the top of the calendar, the page now scrolls up by itself, just like it already did going down.', Icon: IconCalendarFilled, color: 'mint' },
  { date: '2026-10-02', time: '12:22', title: 'Space above 06:00', text: 'The calendar now has a little breathing room above the first hour line, just like it has below the last one.', Icon: IconCalendarFilled, color: 'sky' },
  { date: '2026-10-02', time: '12:01', title: 'Sign out is back', text: 'The weird shadow at the top of Profile was the Sign out button, pushed there by a naming mix-up with the calendar drag. It is back at the bottom, and the same fix returns the Disconnect button too.', Icon: IconShieldFilled, color: 'rose' },
  { date: '2026-10-02', time: '11:40', title: 'Day from 06:00 to 00:00', text: 'The day and week views now show 06:00 until midnight, so there is less scrolling. A task set before 06:00 sits at the very top.', Icon: IconCalendarFilled, color: 'butter' },
  { date: '2026-10-02', time: '11:38', title: 'Faster start', text: 'Muna now remembers your last tasks and events on the phone, so the home screen animation starts straight away when you open the app, and the fresh data fills in a moment later.', Icon: IconHeartFilled, color: 'mint' },
  { date: '2026-10-02', time: '11:34', title: 'A new calendar', text: 'The calendar now opens on the day, hour by hour, with your tasks as soft blocks. Tasks without a time wait in a strip at the top. Press and hold a task, then drag it onto an hour, or up to the strip to make it all-day. Use Day, Week or Month at the top to zoom out.', Icon: IconCalendarFilled, color: 'sky' },
  { date: '2026-10-02', time: '11:27', title: 'Smooth start', text: 'The home cards no longer jump in height while things load. They wait a moment, then softly appear one after another, left to right and top to bottom. Google events on Home now show their own icon, colour and tick too.', Icon: IconHeartFilled, color: 'peach' },
  { date: '2026-10-02', time: '11:22', title: 'Sheets no longer scroll the page behind', text: 'When you scrolled to the end of a task or event sheet, the screen behind it started moving too. Now only the sheet scrolls.', Icon: IconShieldFilled, color: 'sky' },
  { date: '2026-10-02', time: '11:21', title: 'Google events like tasks', text: 'Google Calendar events can now have their own icon and colour, a tick for done, and notes, just like Muna tasks. You both see the changes live, and a repeating event keeps one look on every repeat.', Icon: IconPaletteFilled, color: 'butter' },
  { date: '2026-10-02', time: '11:10', title: 'Personality fixed for good', text: 'Found the real mistake: the personality box could stay empty when you opened Profile. It now always shows the saved text. Muna also retries when Google is busy.', Icon: IconShieldFilled, color: 'rose' },
  { date: '2026-10-02', time: '10:54', title: 'More icons, one search', text: '1,512 Phosphor filled icons (food, drinks and lots more) joined the icon search. One search box now looks through your uploads, Phosphor and Tabler together.', Icon: IconPizzaFilled, color: 'peach' },
  { date: '2026-10-02', time: '10:39', title: 'Edit Google events', text: 'Tap any Google Calendar event, yours or your partner\'s, to change its title, day or time, or delete it. Repeating events change on every repeat (or only one day if you choose). Muna can do it too.', Icon: IconCalendarFilled, color: 'sky' },
  { date: '2026-10-02', time: '10:39', title: 'My icons', text: 'Upload your own SVG icons in Profile. You both see them straight away and can use them for tasks and profiles.', Icon: IconPaletteFilled, color: 'lilac' },
  { date: '2026-10-02', time: '10:28', title: 'Tidier task sheet', text: 'Google Calendar sync is now automatic, Date and Who no longer overlap, the times fit the screen, checkboxes are cuter, and the sheet only moves up and down.', Icon: IconPaletteFilled, color: 'sky' },
  { date: '2026-10-02', time: '09:38', title: 'Repeating tasks', text: 'Tasks can now repeat: every X days, weeks, months or years, on chosen weekdays or dates, with days skipped and an end. Each day has its own tick, and Google Calendar repeats too.', Icon: IconRepeat, color: 'lilac' },
  { date: '2026-10-02', time: '09:38', title: 'New logo', text: 'Muna has a new app icon: the smiling face.', Icon: IconHeartFilled, color: 'peach' },
  { date: '2026-10-02', time: '09:38', title: 'Chat header stays', text: 'Muna and her speaker button now stay at the top while you scroll the chat.', Icon: IconMessageCircleFilled, color: 'mint' },
  { date: '2026-10-02', time: '09:38', title: 'Personality never blank', text: 'The personality text no longer shows empty after the phone wakes up. It was always safe in the database.', Icon: IconShieldFilled, color: 'rose' },
  { date: '2026-10-02', time: '09:38', title: 'Times in the log', text: 'Each update now shows the time next to the date (older ones from before this have none).', Icon: IconTimelineEventFilled, color: 'sky' },
  { date: '2026-10-02', time: '09:18', title: 'Scroll fix', text: 'The chat opens on the latest message without a flash, and every other page (like this log) opens at the top.', Icon: IconBoltFilled, color: 'sky' },
  { date: '2026-10-02', title: 'Chat opens at the end', text: 'When you open the chat, you land on the latest message, like WhatsApp.', Icon: IconMessageCircleFilled, color: 'sky' },
  { date: '2026-10-02', time: '09:00', title: 'Update log', text: 'This list! Every change we make to Muna will show up here.', Icon: IconTimelineEventFilled, color: 'sky' },
  { date: '2026-10-02', time: '09:15', title: 'Cat and dog icons', text: 'The icon search now finds every Tabler icon, filled and outline mixed, so cat, dog and many more are there.', Icon: IconPawFilled, color: 'peach' },
  { date: '2026-10-02', time: '09:00', title: 'Menu animation', text: 'The icon now glides up when its dot appears, and back down when it leaves.', Icon: IconHomeFilled, color: 'lilac' },
  { date: '2026-10-02', time: '08:55', title: 'Message kept', text: 'What you are typing to Muna stays when you switch tabs or close the app.', Icon: IconMessageCircleFilled, color: 'mint' },
  { date: '2026-10-02', time: '08:54', title: 'Shared personality', text: 'You both see and edit the same personality text for Muna.', Icon: IconHeartFilled, color: 'rose' },
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
