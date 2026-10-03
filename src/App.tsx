import { useLayoutEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { TasksProvider } from './context/TasksContext'
import BottomNav from './components/BottomNav'
import Muna from './components/Muna'
import IconSync from './components/IconSync'
import ShoppingSync from './components/ShoppingSync'
import HolidaySync from './components/HolidaySync'
import Login from './pages/Login'
import Home from './pages/Home'
import CalendarPage from './pages/CalendarPage'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import Updates from './pages/Updates'
import Products from './pages/Products'
import Meals from './pages/Meals'
import Pantry from './pages/Pantry'
import { useRoute } from './lib/router'

function Screens() {
  const route = useRoute()
  // Every screen opens at the top (the chat is the exception: it scrolls itself to the newest message).
  useLayoutEffect(() => {
    if (route !== '/chat') window.scrollTo(0, 0)
  }, [route])
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
      <Screens />
      <BottomNav />
    </TasksProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
