'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, Check, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const passwordRequirements = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Number', test: (p: string) => /\d/.test(p) },
];

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="vt-mono block mb-2"
        style={{
          fontSize: '10px',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--ink-2)',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

export default function RegisterPage() {
  const { register, isRegistering } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const passwordStrength = passwordRequirements.filter((req) => req.test(password)).length;
  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isPasswordValid = passwordStrength === passwordRequirements.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name || !email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    if (!isPasswordValid) {
      setError('Password does not meet all requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }
    register({ name, email, password });
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--bg-0)' }}
    >
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Brand */}
        <div className="mb-8">
          <div
            className="vt-display mb-1"
            style={{ fontSize: '28px', color: 'var(--ink-0)' }}
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
            Create your account
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
              <Field id="name" label="Full name">
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  disabled={isRegistering}
                  className="vt-input"
                  style={{ fontSize: '14px' }}
                />
              </Field>

              <Field id="email" label="Email">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  disabled={isRegistering}
                  className="vt-input"
                  style={{ fontSize: '14px' }}
                />
              </Field>

              <Field id="password" label="Password">
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    disabled={isRegistering}
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
                {password.length > 0 && (
                  <ul
                    className="mt-2 space-y-1 vt-mono"
                    style={{ fontSize: '10.5px', letterSpacing: '0.06em' }}
                  >
                    {passwordRequirements.map((req) => (
                      <li
                        key={req.label}
                        className="flex items-center gap-2"
                        style={{ color: req.test(password) ? 'var(--pass)' : 'var(--ink-2)' }}
                      >
                        {req.test(password) ? (
                          <Check className="w-3 h-3 shrink-0" strokeWidth={2} />
                        ) : (
                          <X className="w-3 h-3 shrink-0" strokeWidth={2} />
                        )}
                        {req.label}
                      </li>
                    ))}
                  </ul>
                )}
              </Field>

              <Field id="confirmPassword" label="Confirm password">
                <input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isRegistering}
                  className="vt-input"
                  style={{
                    fontSize: '14px',
                    borderColor:
                      confirmPassword.length > 0 && !passwordsMatch
                        ? 'var(--fail)'
                        : undefined,
                  }}
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p
                    className="vt-mono mt-1"
                    style={{
                      fontSize: '10.5px',
                      letterSpacing: '0.06em',
                      color: 'var(--fail)',
                    }}
                  >
                    Passwords do not match.
                  </p>
                )}
              </Field>
            </div>

            <div className="mt-6">
              <button
                type="submit"
                disabled={isRegistering || !isPasswordValid || !passwordsMatch}
                className="vt-btn vt-btn--primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  'Create account'
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
            Already have an account?{' '}
            <Link href="/login" style={{ color: 'var(--accent)' }}>
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
