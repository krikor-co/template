import { redirect } from 'next/navigation'
import { entry as dashboardEntry } from '@/app/dashboard/entry'

export default function Home() { redirect(dashboardEntry.href()) }
