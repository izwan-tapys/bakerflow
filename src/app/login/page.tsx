'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">

        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="inline-flex w-20 h-20 bg-primary rounded-3xl items-center justify-center text-white text-3xl font-black shadow-2xl shadow-primary/30 transform hover:rotate-3 transition-transform">
            BF
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground">
              Baker<span className="text-primary">Flow</span>
            </h1>
            <p className="text-foreground/50 text-sm mt-1 italic">Your kitchen command centre</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-foreground/5 border border-muted p-8">
          {!sent ? (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-foreground">Welcome back! 👋</h2>
                <p className="text-foreground/60 text-sm mt-1">Enter your email to receive a magic login link.</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-foreground/70 block mb-2">Email Address</label>
                  <input
                    type="email"
                    placeholder="baker@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full h-14 px-4 rounded-2xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-foreground font-medium transition-colors text-base"
                  />
                </div>

                {error && (
                  <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl">⚠️ {error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-14 bg-primary text-white font-bold text-base rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                  {loading ? 'Sending...' : '✉️ Send Magic Link'}
                </button>
              </form>

              <p className="text-center text-foreground/40 text-xs mt-6">
                No password needed. Just tap the link in your email.
              </p>
            </>
          ) : (
            <div className="text-center space-y-4 py-4">
              <div className="text-5xl">📬</div>
              <h2 className="text-xl font-bold text-foreground">Check your inbox!</h2>
              <p className="text-foreground/60 text-sm">
                We sent a magic link to<br />
                <span className="font-bold text-primary">{email}</span>
              </p>
              <p className="text-foreground/40 text-xs">
                Tap the link in the email to log in. You can close this tab.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(''); }}
                className="text-primary text-sm font-medium hover:underline"
              >
                Use a different email →
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-foreground/30 text-xs">
          BakerFlow • Built for home bakers with ❤️
        </p>
      </div>
    </div>
  );
}
