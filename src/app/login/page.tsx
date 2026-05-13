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

  const handleGoogleLogin = async () => {
    setError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) setError(error.message);
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

          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full h-14 bg-white border-2 border-muted text-foreground font-bold text-base rounded-2xl flex items-center justify-center gap-3 hover:bg-muted/50 transition-all mb-4"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="relative flex items-center py-4">
            <div className="flex-grow border-t border-muted"></div>
            <span className="flex-shrink-0 mx-4 text-foreground/40 text-xs font-semibold uppercase">Or</span>
            <div className="flex-grow border-t border-muted"></div>
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
