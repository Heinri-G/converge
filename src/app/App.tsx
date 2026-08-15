import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/query'
import { AppRoutes } from './routes'
import { SupabaseProvider } from './providers'
import { AppShell } from './ui/AppShell'

export default function App() {
  return (
    <SupabaseProvider>
      <QueryClientProvider client={queryClient}>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </QueryClientProvider>
    </SupabaseProvider>
  )
}
