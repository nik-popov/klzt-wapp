import { useEffect, useState } from 'react';
import { api } from '../api/client';

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "We couldn't verify the login. Try again.",
  missing_claims: 'Google did not return an email. Try again.',
  oauth_failed: 'Sign-in failed. Please try again.',
};

export function Login() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('error');
    if (code) setError(ERROR_MESSAGES[code] ?? 'Sign-in failed.');
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">KLZT</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Your AI-powered closet.
          </p>
        </div>

        <a
          href={api.loginUrl()}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
        >
          <GoogleGlyph className="h-5 w-5" />
          Sign in with Google
        </a>

        {error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        <p className="mt-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
          We only use your email and profile picture to identify your closet.
        </p>
      </div>
    </div>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className={className}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.8-2 13.3-5.2l-6.1-5.2C29.1 35 26.7 36 24 36c-5.3 0-9.7-3.1-11.4-7.5l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4-4.1 5.4l6.1 5.2C39.9 36 44 30.6 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}
