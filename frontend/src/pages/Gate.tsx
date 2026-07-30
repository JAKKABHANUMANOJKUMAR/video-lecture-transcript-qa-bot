import React, { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { Button, Field, Input } from '../components/ui';
import { LektaLogo } from '../components/LektaLogo';

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" width="18" height="18" aria-hidden>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

/**
 * The Gate — Lekta's single unauthenticated screen: the wordmark, one
 * poster-scale line and its subtitle on the left, auth card on the right, flat
 * on the Haze canvas. Nothing else on the left — no vignette, no feature tags.
 */
export function Gate() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'up') {
      if (!fullName.trim()) return setError('Tell us your name so we can greet you.');
      if (password.length < 6) return setError('Password needs at least 6 characters.');
      if (password !== confirm) return setError('Passwords don’t match.');
    }
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email, password);
      else await signUp(fullName.trim(), email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      setBusy(false);
    }
  };

  // Demo "Continue with Google": pre-fills the sign-up form with mock Google
  // account details so the user can review and complete sign up (kept from v1).
  const handleGoogle = () => {
    setMode('up');
    setFullName('Google User');
    setEmail('google.user@gmail.com');
    setPassword('google-demo-123');
    setConfirm('google-demo-123');
    setError('');
  };

  const fillDemo = () => {
    setMode('in');
    setEmail('user@example.com');
    setPassword('password');
    setError('');
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas">

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center gap-12 px-6 py-12 lg:flex-row lg:gap-20">
        {/* Wordmark + the one line. Nothing else. */}
        <div className="max-w-xl animate-rise lg:flex-1">
          <div className="mb-10 flex items-center gap-3">
            <LektaLogo size={40} />
            <span className="font-display text-h3 text-ink">Lekta</span>
          </div>
          <h1 className="font-display text-[clamp(40px,6vw,72px)] leading-[1.05] tracking-[-0.025em] text-ink text-balance">
            Ask your lectures anything.
          </h1>
          <p className="mt-6 max-w-md text-lg text-ink-2 text-balance">
            Drop in a lecture video or paste a link. Lekta listens, transcribes,
            and answers your questions — with the exact moment to prove it.
          </p>
        </div>

        {/* Auth card */}
        <div className="w-full max-w-sm animate-rise [animation-delay:120ms]">
          <div className="rounded-panel border border-line bg-surface p-7 shadow-lg">
            <div className="mb-6 flex rounded-full bg-canvas-deep p-1">
              {(['in', 'up'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError('');
                  }}
                  className={
                    'flex-1 rounded-full py-2 text-sm font-semibold transition-all duration-micro ease-study ' +
                    (mode === m ? 'bg-surface text-ink shadow-sm' : 'text-ink-2 hover:text-ink')
                  }
                >
                  {m === 'in' ? 'Sign in' : 'Create account'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'up' && (
                <Field label="Full name" htmlFor="gate-name">
                  <Input
                    id="gate-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ada Lovelace"
                    autoComplete="name"
                  />
                </Field>
              )}
              <Field label="Email" htmlFor="gate-email">
                <Input
                  id="gate-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </Field>
              <Field label="Password" htmlFor="gate-pass" error={error || undefined}>
                <Input
                  id="gate-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                />
              </Field>
              {mode === 'up' && (
                <Field label="Confirm password" htmlFor="gate-confirm">
                  <Input
                    id="gate-confirm"
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </Field>
              )}
              <Button type="submit" size="lg" loading={busy} className="w-full">
                {mode === 'in' ? 'Enter your study' : 'Start studying'}
              </Button>
            </form>

            <div className="my-5 flex items-center gap-3 text-cap text-ink-3">
              <i className="h-px flex-1 bg-line" />
              or
              <i className="h-px flex-1 bg-line" />
            </div>

            <Button variant="secondary" onClick={handleGoogle} className="w-full" icon={<GoogleIcon />}>
              Continue with Google
            </Button>

            <button
              onClick={fillDemo}
              className="mt-5 w-full text-center text-cap text-ink-3 transition-colors duration-micro hover:text-accent-deep"
            >
              Just exploring? Use the demo account →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
