import React from "react";

export default function OrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex justify-center p-0 md:p-4">
      {/* Mobile-first Container */}
      <div className="w-full max-w-lg bg-white min-h-screen md:min-h-[90vh] md:rounded-[3rem] md:shadow-2xl md:my-auto overflow-hidden flex flex-col">
        {/* Simple Header */}
        <header className="p-6 flex items-center justify-between border-b border-muted">
          <span className="text-xl font-bold text-primary">BakerFlow</span>
          <div className="text-xs text-foreground/40 font-medium">Ordering Portal</div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
