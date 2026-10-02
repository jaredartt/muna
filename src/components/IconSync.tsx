import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { startCustomIconSync } from '../lib/customIcons'
import { startEventStyleSync } from '../lib/eventStyles'
import { startProductSync } from '../lib/products'

// Keeps the home's uploaded icons and the look of Google events loaded and live (renders nothing).
export default function IconSync() {
  const { profile } = useAuth()
  const householdId = profile?.household_id
  useEffect(() => {
    if (!householdId) return
    const stopIcons = startCustomIconSync(householdId)
    const stopStyles = startEventStyleSync(householdId)
    const stopProducts = startProductSync(householdId)
    return () => {
      stopIcons()
      stopStyles()
      stopProducts()
    }
  }, [householdId])
  return null
}
