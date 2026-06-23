import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';

const router = createBrowserRouter([
  {
    path: '/',
    element: <Dashboard />,
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
        <p className="mt-2 text-neutral-500">That closet doesn't exist.</p>
        <a
          href="/"
          className="mt-4 inline-block text-sm font-medium text-neutral-900 underline"
        >
          Back to gallery
        </a>
      </div>
    </div>
  );
}
