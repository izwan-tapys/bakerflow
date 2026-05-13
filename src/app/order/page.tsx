export default function OrderPage() {
  return (
    <div className="p-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Place Your Order</h1>
        <p className="text-foreground/60">Choose your date and product below.</p>
      </div>
      <div className="space-y-4">
        {[1, 2, 4].map((i) => (
          <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
        ))}
      </div>
      <button className="w-full h-14 bg-primary text-white rounded-2xl font-bold">
        Continue to Checkout
      </button>
    </div>
  );
}
