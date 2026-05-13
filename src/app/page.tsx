import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-8 font-sans">
      <main className="max-w-md w-full text-center space-y-12">
        {/* Logo Placeholder */}
        <div className="flex flex-col items-center space-y-2">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform">
            <span className="text-white text-4xl font-bold">BF</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
            Baker<span className="text-primary">Flow</span>
          </h1>
          <p className="text-foreground/60 italic text-sm">
            Empowering Solo-Bakers Everywhere
          </p>
        </div>

        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-foreground/80">
            Welcome to your kitchen partner.
          </h2>
          <p className="text-foreground/70 leading-relaxed">
            Automate your orders, manage your production, and grow your baking business without the administrative stress.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <Link
            href="/dashboard"
            className="group relative flex h-14 items-center justify-center rounded-2xl bg-primary text-white font-semibold text-lg shadow-xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
          >
            Go to Dashboard
          </Link>
          <Link
            href="/order"
            className="flex h-14 items-center justify-center rounded-2xl border-2 border-primary/20 text-primary font-semibold text-lg transition-all hover:bg-primary/5 active:scale-95"
          >
            View Customer Portal
          </Link>
        </div>

        <footer className="pt-12 text-foreground/40 text-xs">
          Built with precision by Antigravity
        </footer>
      </main>
    </div>
  );
}
