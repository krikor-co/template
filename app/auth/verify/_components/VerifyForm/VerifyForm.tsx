'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { scene } from './scene';
import { verifyOtpAction } from './actions';
import type { State } from './state';
import { useEffect } from 'react';

export function VerifyForm({ initialState }: { initialState: State }) {
  const [state, send] = scene.useScene(initialState);
  const [code, setCode] = useState('');
  const router = useRouter();

  const handleSubmit = async (formData: FormData) => {
    send({ type: 'SUBMIT' });
    const result = await verifyOtpAction(formData);
    if (result.success)
      send({ type: 'SUCCESS', redirectTo: result.redirectTo });
    else if (result && result.error) send({ type: 'ERROR', message: result.error });
  };

  useEffect(() => {
    if (state.status === 'success') {
      setTimeout(() => router.push(state.redirectTo), 2000);
    }
  }, [state, router]);

  switch (state.status) {
    case 'idle':
    case 'submitting':
    case 'error':
      return (
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="mb-2 text-3xl font-semibold tracking-tight">Check your email</h1>
            <p className="text-muted-foreground">
              We sent a 6-digit code to <strong>{state.email}</strong>
            </p>
          </div>
          <form action={handleSubmit} className="space-y-4">
            <input type="hidden" name="email" value={state.email} />
            <input type="hidden" name="returnTo" value={state.returnTo ?? ''} />

            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Verification code
              </label>
              <input
                id="code"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => {
                  if (state.status === 'error') send({ type: 'RETRY' });
                  setCode(e.target.value);
                }}
                className="w-full rounded-md border px-3 py-2 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="000000"
              />
            </div>

            {state.status === 'error' && (
              <p data-testid="error-message" className="text-sm text-destructive">{state.message}</p>
            )}

            <button
              type="submit"
              disabled={state.status === 'submitting'}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {state.status === 'submitting' ? 'Verifying…' : 'Verify code'}
            </button>
          </form>
        </div>
      );

    case 'success':
      return (
        <p className="text-center text-sm text-muted-foreground">
          Verified! Redirecting…
        </p>
      );
  }
}
