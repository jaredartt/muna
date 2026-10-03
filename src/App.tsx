import { useLayoutEffect, useRef } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ConfirmProvider } from './components/Confirm'
import { TasksProvider } from './context/TasksContext'
import BottomNav from './components/BottomNav'
import Muna from './components/Muna'
import IconSync from './components/IconSync'
import ShoppingSync from './components/ShoppingSync'
import HolidaySync from './components/HolidaySync'
import HobbySync from './components/HobbySync'
import Login from './pages/Login'
import Home from './pages/Home'
import CalendarPage from './pages/CalendarPage'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import Updates from './pages/Updates'
import Products from './pages/Products'
import Meals from './pages/Meals'
import Pantry from './pages/Pantry'
import Uni from './pages/Uni'
import Hobbies from './pages/Hobbies'
import WeatherPage from './pages/WeatherPage'
import Gym from './pages/Gym'
import { useRoute, slideDir, type Route } from './lib/router'

function Screens() {
  const route = useRoute()
  // the slide direction of this change (works for the bottom menu, buttons and the browser's back button alike)
  const prev = useRef<Route>(route)
  const dir = useRef<'fwd' | 'back'>('fwd')
  if (prev.current !== route) {
    dir.current = slideDir(prev.current, route)
    prev.current = route
  }
  // Every screen opens at the top (the chat is the exception: it scrolls itself to the newest message).
  useLayoutEffect(() => {
    if (route !== '/chat') window.scrollTo(0, 0)
  }, [route])
  return (
    <div key={route} className={'screen-in ' + dir.current}>
      <Screen route={route} />
    </div>
  )
}

function Screen({ route }: { route: Route }) {
  switch (route) {
    case '/calendar':
      return <CalendarPage />
    case '/chat':
      return <Chat />
    case '/profile':
      return <Profile />
    case '/updates':
      return <Updates />
    case '/products':
      return <Products />
    case '/meals':
      return <Meals />
    case '/pantry':
      return <Pantry />
    case '/uni':
      return <Uni />
    case '/hobbies':
      return <Hobbies />
    case '/weather':
      return <WeatherPage />
    case '/gym':
      return <Gym />
    default:
      return <Home />
  }
}

function Shell() {
  const { loading, session, profile } = useAuth()
  if (loading) {
    return (
      <div className="splash">
        <Muna size={110} mood="sleepy" />
      </div>
    )
  }
  if (!session) return <Login />
  if (!profile) {
    return (
      <div className="splash">
        <Muna size={110} mood="thinking" />
      </div>
    )
  }
  return (
    <TasksProvider>
      <IconSync />
      <ShoppingSync />
      <HolidaySync />
      <HobbySync />
      <Screens />
      <BottomNav />
    </TasksProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Shell />
      </ConfirmProvider>
    </AuthProvider>
  )
}
