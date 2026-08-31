'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '../services/authService';
import { emailPasswordSchema, magicLinkSchema } from '../validation/authSchema';
import type { AuthMode } from '../types';
import { Loader2, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      if (mode === 'magiclink') {
        const validation = magicLinkSchema.safeParse({ email });
        if (!validation.success) {
          setError(validation.error.errors[0]?.message || 'Invalid email');
          setIsLoading(false);
          return;
        }

        await authService.signInWithOtp(email);
        setSuccessMessage('A login link has been sent to your email address.');
      } else if (mode === 'signup') {
        const validation = emailPasswordSchema.safeParse({ email, password });
        if (!validation.success) {
          setError(validation.error.errors[0]?.message || 'Invalid input');
          setIsLoading(false);
          return;
        }

        const data = await authService.signUp(email, password);
        if (data.session) {
          router.push('/dashboard');
          router.refresh();
        } else {
          setSuccessMessage('Account created! Please check your email to confirm your account.');
        }
      } else {
        // signin
        const validation = emailPasswordSchema.safeParse({ email, password });
        if (!validation.success) {
          setError(validation.error.errors[0]?.message || 'Invalid input');
          setIsLoading(false);
          return;
        }

        await authService.signInWithPassword(email, password);
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-serif tracking-tight text-foreground">
          Creative Workspace
        </h1>
        <p className="text-xs text-muted-foreground mt-1.5">
          A spatial home for reference, moodboard & creative direction.
        </p>
      </div>

      <Card className="border-border/80 bg-surface shadow-subtle">
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-medium">
            {mode === 'signin' && 'Sign in to workspace'}
            {mode === 'signup' && 'Create an account'}
            {mode === 'magiclink' && 'Sign in with Magic Link'}
          </CardTitle>
          <CardDescription className="text-xs">
            {mode === 'signin' && 'Enter your credentials to access your projects'}
            {mode === 'signup' && 'Enter your details to start a new workspace'}
            {mode === 'magiclink' && 'We’ll email you a secure link to log in instantly'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-danger/10 border border-danger/30 text-red-400 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-950/40 border border-emerald-800/40 text-emerald-400 text-xs">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                required
                autoComplete="email"
              />
            </div>

            {mode !== 'magiclink' && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="password">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                />
              </div>
            )}

            <Button
              type="submit"
              className="w-full mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  {mode === 'signin' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'magiclink' && 'Send Magic Link'}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-5 pt-4 border-t border-border-subtle flex flex-col space-y-2 text-center text-xs text-muted-foreground">
            {mode === 'signin' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="hover:text-foreground transition-colors"
                >
                  Don&apos;t have an account? <span className="text-accent underline">Sign up</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('magiclink');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className="hover:text-foreground text-xs text-muted-foreground/80 transition-colors"
                >
                  Use passwordless Magic Link
                </button>
              </>
            ) : mode === 'signup' ? (
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="hover:text-foreground transition-colors"
              >
                Already have an account? <span className="text-accent underline">Sign in</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="hover:text-foreground transition-colors"
              >
                Back to <span className="text-accent underline">password sign in</span>
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
