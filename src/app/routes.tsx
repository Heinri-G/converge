import { lazy, Suspense } from 'react'
import { Navigate, useRoutes } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { ScreenFallback } from '../components/ui/ScreenFallback'

const HomeScreen = lazy(() => import('../features/home/HomeScreen'))
const ResearchScreen = lazy(() => import('../features/research/ResearchScreen'))
const HistoryScreen = lazy(() => import('../features/history/HistoryScreen'))

const routes: RouteObject[] = [
  { path: '/', element: <HomeScreen /> },
  { path: '/research', element: <ResearchScreen /> },
  { path: '/history', element: <HistoryScreen /> },
  { path: '*', element: <Navigate to="/" replace /> },
]

export function AppRoutes() {
  return (
    <Suspense fallback={<ScreenFallback />}>
      {useRoutes(routes)}
    </Suspense>
  )
}
