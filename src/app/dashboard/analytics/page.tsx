'use client';



export default function AnalyticsPage() {
  return (
    <div className="space-y-6 pb-20">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="pt-8 pb-4">
          <h1 className="text-2xl font-black text-foreground">Analytics 📊</h1>
          <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Business Performance</p>
        </div>
      </div>

      <div className="bg-card rounded-3xl p-10 border-2 border-dashed border-muted text-center space-y-4">
        <div className="text-5xl">📈</div>
        <div>
          <h2 className="text-lg font-black text-foreground">Analytics is coming soon!</h2>
          <p className="text-sm font-medium text-foreground/40">We are building advanced charts to help you track your bakery's growth.</p>
        </div>
      </div>
    </div>
  );
}
