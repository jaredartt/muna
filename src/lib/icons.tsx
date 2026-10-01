import type { ComponentType } from 'react'
import {
  IconChecklist, IconShoppingCart, IconToolsKitchen2, IconHeart, IconHome, IconBriefcase,
  IconPlane, IconPaw, IconBarbell, IconBook, IconPhone, IconGift, IconCar, IconPill,
  IconCoffee, IconMoneybag, IconCake, IconShirt, IconPlant, IconMusic, IconStethoscope,
  IconSchool, IconDeviceLaptop, IconCalendarEvent, IconPizza, IconBed, IconBulb, IconStar,
  IconCat, IconDog, IconSun, IconMoon, IconSparkles, IconBike, IconTrees, IconFlower, IconBabyCarriage,
} from '@tabler/icons-react'

type IconCmp = ComponentType<{ size?: number | string; stroke?: number | string; className?: string }>

// Icons you can pick for a task. Keep these keys in sync with
// supabase/functions/muna-chat/index.ts (TASK_ICONS) so Muna can choose them too.
export const TASK_ICONS: Record<string, IconCmp> = {
  checklist: IconChecklist,
  shopping: IconShoppingCart,
  kitchen: IconToolsKitchen2,
  pizza: IconPizza,
  coffee: IconCoffee,
  cake: IconCake,
  home: IconHome,
  bed: IconBed,
  heart: IconHeart,
  gift: IconGift,
  work: IconBriefcase,
  laptop: IconDeviceLaptop,
  school: IconSchool,
  book: IconBook,
  event: IconCalendarEvent,
  phone: IconPhone,
  travel: IconPlane,
  car: IconCar,
  bike: IconBike,
  health: IconStethoscope,
  pill: IconPill,
  fitness: IconBarbell,
  money: IconMoneybag,
  clothes: IconShirt,
  plant: IconPlant,
  nature: IconTrees,
  flower: IconFlower,
  music: IconMusic,
  idea: IconBulb,
  baby: IconBabyCarriage,
  pet: IconPaw,
  star: IconStar,
}

// Profile avatars
export const AVATARS: Record<string, IconCmp> = {
  cat: IconCat,
  dog: IconDog,
  paw: IconPaw,
  plant: IconPlant,
  flower: IconFlower,
  star: IconStar,
  sun: IconSun,
  moon: IconMoon,
  heart: IconHeart,
  coffee: IconCoffee,
  music: IconMusic,
  sparkles: IconSparkles,
}

export function TaskIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Cmp = TASK_ICONS[name] ?? IconChecklist
  return <Cmp size={size} stroke={1.8} />
}

export function AvatarIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Cmp = AVATARS[name] ?? IconCat
  return <Cmp size={size} stroke={1.8} />
}

export const TASK_COLORS = ['mint', 'peach', 'lilac', 'sky', 'butter', 'rose'] as const
