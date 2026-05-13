'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        router.push('/dashboard');
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        // Redirect to setup page for new accounts
        router.push('/dashboard/setup');
      }
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
          <div className="mb-6">
            <h2 className="text-xl font-bold text-foreground">
              {isLogin ? 'Welcome back! 👋' : 'Create an account 🚀'}
            </h2>
            <p className="text-foreground/60 text-sm mt-1">
              {isLogin ? 'Enter your details to log in.' : 'Sign up to manage your bakery.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
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

            <div>
              <label className="text-sm font-semibold text-foreground/70 block mb-2">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full h-14 px-4 rounded-2xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-foreground font-medium transition-colors text-base"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl">⚠️ {error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full h-14 bg-primary text-white font-bold text-base rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100 mt-2"
            >
              {loading ? 'Processing...' : isLogin ? 'Log In' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-primary text-sm font-bold hover:underline"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
            </button>
          </div>
        </div>

        <p className="text-center text-foreground/30 text-xs">
          BakerFlow • Built for home bakers with ❤️
        </p>
      </div>
    </div>
  );
}
