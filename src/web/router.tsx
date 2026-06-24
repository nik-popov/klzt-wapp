import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { RequireAuth } from './components/RequireAuth';
import { Login } from './pages/Login';

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <RequireAuth>
        <Dashboard />
      </RequireAuth>
    ),
  },
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center text-center">
      <div>
        <h1 className="text-2xl font-semibold">404</h1>
        <p className="mt-2 text-neutral-500 dark:text-neutral-400">
          That closet doesn't exist.
        </p>
        <a
          href="/"
          className="mt-4 inline-block text-sm font-medium text-neutral-900 underline dark:text-neutral-100"
        >
          Back to gallery
        </a>
      </div>
    </div>
  );
}
