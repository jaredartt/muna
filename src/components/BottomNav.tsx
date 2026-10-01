import { IconCalendar, IconHome2, IconMessages, IconUser } from '@tabler/icons-react'
import { navigate, useRoute, type Route } from '../lib/router'

const ITEMS: { route: Route; label: string; Icon: typeof IconHome2 }[] = [
  { route: '/', label: 'Home', Icon: IconHome2 },
  { route: '/calendar', label: 'Calendar', Icon: IconCalendar },
  { route: '/chat', label: 'Chat with Muna', Icon: IconMessages },
  { route: '/profile', label: 'Profile', Icon: IconUser },
]

// Floating coral pill, like the Figma design: home, calendar, chat, profile.
export default function BottomNav() {
  const route = useRoute()
  return (
    <nav className="bottom-nav" aria-label="Main">
      {ITEMS.map(({ route: r, label, Icon }) => (
        <button
          key={r}
          className={'nav-btn' + (route === r ? ' active' : '')}
          onClick={() => navigate(r)}
          aria-label={label}
          aria-current={route === r ? 'page' : undefined}
        >
          <Icon size={32} stroke={1.8} />
          <i className="nav-dot" />
        </button>
      ))}
    </nav>
  )
}
