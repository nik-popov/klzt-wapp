import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './router';
import { ApiError } from './api/client';

const queryClient = new QueryClient({
  // Anywhere a query returns 401 we send the user to /login. This covers
  // session expiry mid-session without each hook needing its own check.
  queryCache: new QueryCache({
    onError: (err) => {
      if (
        err instanceof ApiError &&
        err.status === 401 &&
        typeof window !== 'undefined' &&
        window.location.pathname !== '/login'
      ) {
        window.location.href = '/login';
      }
    },
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}
