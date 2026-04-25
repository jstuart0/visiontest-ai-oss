'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
  const { login, isLoggingIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Both fields are required.');
      return;
    }
    login({ email, password });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg-0)' }}
    >
      <div style={{ width: '100%', maxWidth: '400px' }}>
        {/* Brand */}
        <div className="mb-8">
          <div
            className="vt-display mb-1"
            style={{
              fontSize: '28px',
              color: 'var(--ink-0)',
            }}
          >
            visiontest<span style={{ color: 'var(--accent)' }}>·</span>ai
          </div>
          <p
            className="vt-mono"
            style={{
              fontSize: '10px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--ink-2)',
            }}
          >
            Sign in to continue
          </p>
        </div>

        {/* Form */}
        <div
          style={{
            border: '1px solid var(--rule-strong)',
            background: 'var(--bg-1)',
            padding: '28px',
          }}
        >
          <form onSubmit={handleSubmit} noValidate>
            {error && (
              <div
                className="mb-5 px-4 py-3 vt-mono"
                style={{
                  background: 'var(--fail-soft)',
                  borderLeft: '2px solid var(--fail)',
                  fontSize: '12px',
                  letterSpacing: '0.06em',
                  color: 'var(--fail)',
                }}
              >
                {error}
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="vt-mono block mb-2"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={isLoggingIn}
                  className="vt-input"
                  style={{ fontSize: '14px' }}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="vt-mono block mb-2"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-2)',
                  }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isLoggingIn}
                    className="vt-input"
                    style={{ fontSize: '14px', paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--ink-2)' }}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                    ) : (
                      <Eye className="w-4 h-4" strokeWidth={1.5} />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={isLoggingIn}
                className="vt-btn vt-btn--primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </div>
          </form>

          <div
            className="mt-6 pt-5 vt-mono text-center"
            style={{
              borderTop: '1px solid var(--rule)',
              fontSize: '11px',
              letterSpacing: '0.1em',
              color: 'var(--ink-2)',
            }}
          >
            No account?{' '}
            <Link
              href="/register"
              style={{ color: 'var(--accent)' }}
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
