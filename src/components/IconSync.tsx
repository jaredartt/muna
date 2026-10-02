import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { startCustomIconSync } from '../lib/customIcons'

// Keeps the home's uploaded icons loaded and live (renders nothing).
export default function IconSync() {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  useEffect(() => {
    if (!householdId) return
    return startCustomIconSync(householdId)
  }, [householdId])
  return null
}
