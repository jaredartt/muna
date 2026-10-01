import { useEffect, useState, type ComponentType } from 'react'
import {
  IconCircleCheckFilled, IconShoppingCartFilled, IconChefHatFilled, IconPizzaFilled, IconCoffee, IconCake,
  IconHomeFilled, IconBedFilled, IconHeartFilled, IconGiftFilled, IconBriefcaseFilled, IconDeviceLaptop,
  IconSchool, IconBookFilled, IconCalendarEventFilled, IconPhoneFilled, IconPlane, IconCarFilled, IconBikeFilled,
  IconStethoscope, IconPillFilled, IconBarbellFilled, IconMoneybag, IconShirtFilled, IconPlant, IconTrees,
  IconFlowerFilled, IconMusic, IconBulbFilled, IconBabyCarriageFilled, IconPawFilled, IconStarFilled,
} from '@tabler/icons-react'

type IconProps = { size?: number | string; stroke?: number | string; className?: string }
export type IconCmp = ComponentType<IconProps>

// Icons shown first when picking an icon for a task. Filled style (https://tabler.io/icons, "Filled").
// A few have no filled version in Tabler (coffee, cake, plane, ...), so those use the outline one.
// Keep these KEYS in sync with TASK_ICONS in supabase/functions/muna-chat/index.ts so Muna can choose them too.
export const TASK_ICONS: Record<string, IconCmp> = {
  checklist: IconCircleCheckFilled,
  shopping: IconShoppingCartFilled,
  kitchen: IconChefHatFilled,
  pizza: IconPizzaFilled,
  coffee: IconCoffee,
  cake: IconCake,
  home: IconHomeFilled,
  bed: IconBedFilled,
  heart: IconHeartFilled,
  gift: IconGiftFilled,
  work: IconBriefcaseFilled,
  laptop: IconDeviceLaptop,
  school: IconSchool,
  book: IconBookFilled,
  event: IconCalendarEventFilled,
  phone: IconPhoneFilled,
  travel: IconPlane,
  car: IconCarFilled,
  bike: IconBikeFilled,
  health: IconStethoscope,
  pill: IconPillFilled,
  fitness: IconBarbellFilled,
  money: IconMoneybag,
  clothes: IconShirtFilled,
  plant: IconPlant,
  nature: IconTrees,
  flower: IconFlowerFilled,
  music: IconMusic,
  idea: IconBulbFilled,
  baby: IconBabyCarriageFilled,
  pet: IconPawFilled,
  star: IconStarFilled,
}

// Suggested profile icons (all filled). People can also search the whole Tabler filled set.
export const AVATAR_SUGGESTIONS = [
  'IconPawFilled', 'IconHeartFilled', 'IconStarFilled', 'IconSunFilled', 'IconMoonFilled', 'IconFlowerFilled',
  'IconBoltFilled', 'IconDiamondFilled', 'IconGhostFilled', 'IconBellFilled', 'IconCloudFilled', 'IconUmbrellaFilled',
  'IconMushroomFilled', 'IconAppleFilled', 'IconBikeFilled', 'IconPizzaFilled', 'IconBulbFilled', 'IconPaletteFilled',
  'IconHeadphonesFilled', 'IconCameraFilled',
]

export const TASK_COLORS = ['mint', 'peach', 'lilac', 'sky', 'butter', 'rose'] as const

// ---- Any other Tabler icon is loaded on demand (the full library is big, so it is only fetched when needed) ----
type Lib = Record<string, IconCmp>
let libPromise: Promise<Lib> | null = null
let libCache: Lib | null = null

export function loadTablerLib(): Promise<Lib> {
  if (!libPromise) {
    libPromise = import('@tabler/icons-react').then((m) => {
      libCache = m as unknown as Lib
      return libCache
    })
  }
  return libPromise
}

export function useTablerLib(enabled: boolean): Lib | null {
  const [lib, setLib] = useState<Lib | null>(libCache)
  useEffect(() => {
    if (!enabled || libCache) {
      if (libCache && !lib) setLib(libCache)
      return
    }
    let alive = true
    loadTablerLib().then((l) => alive && setLib(l))
    return () => {
      alive = false
    }
  }, [enabled, lib])
  return lib
}

let filledNames: string[] | null = null
export function filledIconNames(lib: Lib): string[] {
  if (!filledNames) filledNames = Object.keys(lib).filter((k) => /^Icon.+Filled$/.test(k)).sort()
  return filledNames
}

/** IconToolsKitchenFilled -> tools-kitchen (what people search for). */
export function iconSearchName(name: string): string {
  return name
    .replace(/^Icon/, '')
    .replace(/Filled$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
}

function DynamicIcon({ name, size }: { name: string; size: number }) {
  const lib = useTablerLib(true)
  const Cmp = lib?.[name]
  if (!Cmp) return <span style={{ display: 'inline-block', width: size, height: size }} />
  return <Cmp size={size} stroke={1.8} />
}

/** Renders a stored icon: a Muna icon key (e.g. "pizza") or a Tabler component name (e.g. "IconBeerFilled"). */
export function AppIcon({ name, size = 20 }: { name: string; size?: number }) {
  const curated = TASK_ICONS[name]
  if (curated) {
    const Cmp = curated
    return <Cmp size={size} stroke={1.8} />
  }
  if (/^Icon[A-Za-z0-9]+$/.test(name)) return <DynamicIcon name={name} size={size} />
  const Fallback = IconCircleCheckFilled
  return <Fallback size={size} />
}

export const TaskIcon = AppIcon
export const AvatarIcon = AppIcon
