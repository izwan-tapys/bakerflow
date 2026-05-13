import React from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-muted">
        <span className="text-xl font-bold text-primary">BakerFlow</span>
        <div className="w-8 h-8 rounded-full bg-primary/10" />
      </header>

      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-muted p-6 space-y-8">
        <div className="text-2xl font-bold text-primary">BakerFlow</div>
        <nav className="flex-1 space-y-2">
          {["Dashboard", "Orders", "Production", "Inventory", "Settings"].map((item) => (
            <div
              key={item}
              className="px-4 py-2 rounded-xl text-foreground/60 hover:bg-primary/5 hover:text-primary cursor-pointer transition-colors"
            >
              {item}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
