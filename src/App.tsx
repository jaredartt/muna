import { AuthProvider, useAuth } from './context/AuthContext'
import { TasksProvider } from './context/TasksContext'
import BottomNav from './components/BottomNav'
import Muna from './components/Muna'
import Login from './pages/Login'
import Home from './pages/Home'
import CalendarPage from './pages/CalendarPage'
import Chat from './pages/Chat'
import Profile from './pages/Profile'
import Updates from './pages/Updates'
import { useRoute } from './lib/router'

function Screens() {
  const route = useRoute()
  switch (route) {
    case '/calendar':
      return <CalendarPage />
    case '/chat':
      return <Chat />
    case '/profile':
      return <Profile />
    case '/updates':
      return <Updates />
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
