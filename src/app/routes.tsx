import { lazy, Suspense } from 'react'
import { Navigate, useRoutes } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { ScreenFallback } from '../components/ui/ScreenFallback'

const HomeScreen = lazy(() => import('../features/home/HomeScreen'))
const ResearchScreen = lazy(() => import('../features/research/ResearchScreen'))
const HistoryScreen = lazy(() => import('../features/history/HistoryScreen'))
const SignInScreen = lazy(() => import('../features/auth/SignInScreen'))
const DemoScreen = lazy(() => import('../features/demo/DemoScreen'))
const ReportScreen = lazy(() => import('../features/synthesis/ReportScreen'))
const SharedReportScreen = lazy(() => import('../features/reports/SharedReportScreen'))

const routes: RouteObject[] = [
  { path: '/', element: <HomeScreen /> },
  { path: '/research', element: <ResearchScreen /> },
  { path: '/history', element: <HistoryScreen /> },
  { path: '/signin', element: <SignInScreen /> },
  { path: '/demo', element: <DemoScreen /> },
  { path: '/report', element: <ReportScreen /> },
  { path: '/r/:token', element: <SharedReportScreen /> },
  { path: '*', element: <Navigate to="/" replace /> },
]

export function AppRoutes() {
  return <Suspense fallback={<ScreenFallback />}>{useRoutes(routes)}</Suspense>
}
