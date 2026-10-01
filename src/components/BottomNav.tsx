import { IconCalendarFilled, IconHomeFilled, IconMessageCircleFilled, IconUserFilled } from '@tabler/icons-react'
import { navigate, useRoute, type Route } from '../lib/router'

const ITEMS: { route: Route; label: string; Icon: typeof IconHomeFilled }[] = [
  { route: '/', label: 'Home', Icon: IconHomeFilled },
  { route: '/calendar', label: 'Calendar', Icon: IconCalendarFilled },
  { route: '/chat', label: 'Chat with Muna', Icon: IconMessageCircleFilled },
  { route: '/profile', label: 'Profile', Icon: IconUserFilled },
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
          <Icon size={32} />
          <i className="nav-dot" />
        </button>
      ))}
    </nav>
  )
}
