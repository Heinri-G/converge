import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/query'
import { AppRoutes } from './routes'
import { SupabaseProvider } from './providers'
import { AuthProvider } from '../features/auth/AuthProvider'
import { AppShell } from './ui/AppShell'

export default function App() {
  return (
    <SupabaseProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <AppShell>
            <AppRoutes />
          </AppShell>
        </QueryClientProvider>
      </AuthProvider>
    </SupabaseProvider>
  )
}
