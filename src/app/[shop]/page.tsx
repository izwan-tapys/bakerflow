'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import { formatDate } from '@/lib/utils';

interface Product {
  id?: string;
  name: string;
  description?: string;
  price: number;
  is_active: boolean;
}

interface BakerInfo {
  baker_id?: string;
  shop_name: string;
  daily_capacity: number;
  home_address: string;
  whatsapp_number: string;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
}

export default function OrderPage() {
  const params = useParams();
  const shopSlug = typeof params.shop === 'string' ? params.shop.replace(/-/g, ' ') : '';

  const [step, setStep] = useState<'calendar' | 'form' | 'payment' | 'success'>('calendar');
  const [bakerInfo, setBakerInfo] = useState<BakerInfo | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    quantity: 1,
    special_notes: '',
    payment_method: 'manual_transfer' as 'manual_transfer' | 'cod',
  });

  const loadBakerData = useCallback(async () => {
    // Search for the baker using the shop name slug from the URL
    // We remove the is_setup_complete check to make it easier for testing
    const { data: settingsData } = await supabase
      .from('baker_settings')
      .select('baker_id, shop_name, daily_capacity, home_address, whatsapp_number, bank_name, bank_account, bank_holder')
      .ilike('shop_name', shopSlug)
      .limit(1)
      .single();

    if (settingsData) {
      setBakerInfo(settingsData);
      
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('baker_id', settingsData.baker_id)
        .eq('is_active', true);
        
      if (productsData) setProducts(productsData);
    }
    
    setLoading(false);
  }, [shopSlug]);

  useEffect(() => { loadBakerData(); }, [loadBakerData]);

  // Generate today and next 14 days for the calendar
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i <= 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const handleSubmitOrder = async () => {
    if (!selectedProduct || !selectedDate || !bakerInfo?.baker_id) return;
    setSubmitting(true);

    const total = (selectedProduct.price * form.quantity) + 10;

    const orderPayload = {
      baker_id: bakerInfo.baker_id,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      customer_address: form.customer_address,
      product_name: selectedProduct.name,
      quantity: form.quantity,
      unit_price: selectedProduct.price,
      delivery_fee: 10,
      total_amount: total,
      delivery_date: selectedDate,
      status: 'pending',
      payment_method: form.payment_method,
      payment_status: 'unpaid',
      special_notes: form.special_notes,
    };

    const { data: order, error } = await supabase.from('orders').insert(orderPayload).select().single();

    if (!error && order) {
      setOrderNumber(order.order_number || `BF-${Date.now()}`);
      setStep('success');
    }
    setSubmitting(false);
  };

  const availableDates = getAvailableDates();

  if (loading) {
    return (
      <div className="p-8 space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded-xl" />
        <div className="h-40 bg-muted rounded-2xl" />
      </div>
    );
  }

  if (!bakerInfo) {
    return (
      <div className="p-8 text-center space-y-3 py-16">
        <div className="text-4xl">😔</div>
        <p className="text-foreground/60">This order portal is not available yet.</p>
        <p className="text-[10px] text-foreground/20 font-mono">Debug: Looking for &quot;{shopSlug}&quot;</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-6 pb-8">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="w-16 h-16 bg-primary rounded-2xl mx-auto flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-primary/20">
          🎂
        </div>
        <h1 className="text-xl font-extrabold text-foreground">{bakerInfo.shop_name}</h1>
        <p className="text-foreground/50 text-sm">Place your order below</p>
      </div>

      {/* Step: Calendar */}
      {step === 'calendar' && (
        <div className="space-y-5">
          <div>
            <h2 className="font-bold text-foreground mb-1">📅 Pick a Delivery Date</h2>
            <p className="text-foreground/50 text-sm">Select when you want your order delivered.</p>
          </div>

          <div className="flex overflow-x-auto gap-3 pb-4 pt-1 snap-x scrollbar-hide">
            {availableDates.map(date => {
              const dateStr = date.toISOString().split('T')[0];
              const isSelected = selectedDate === dateStr;
              const dayName = date.toLocaleDateString('en-MY', { weekday: 'short' });
              const dayNum = date.getDate();
              const month = date.toLocaleDateString('en-MY', { month: 'short' });

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex-shrink-0 w-[4.5rem] flex flex-col items-center p-3 rounded-2xl border-2 transition-all snap-center ${
                    isSelected
                      ? 'border-primary bg-primary text-white shadow-lg shadow-primary/30 transform scale-105'
                      : 'border-muted bg-white text-foreground hover:border-primary/30'
                  }`}
                >
                  <span className={`text-xs font-medium ${isSelected ? 'text-white/80' : 'text-foreground/40'}`}>{dayName}</span>
                  <span className="text-2xl font-extrabold mt-0.5">{dayNum}</span>
                  <span className={`text-[10px] font-bold uppercase mt-1 ${isSelected ? 'text-white/80' : 'text-foreground/40'}`}>{month}</span>
                </button>
              );
            })}
          </div>

          {/* Product Selection */}
          {products.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-bold text-foreground">🧁 Choose Your Cake</h2>
              {products.map(product => (
                <button
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                    selectedProduct?.id === product.id
                      ? 'border-primary bg-primary/5'
                      : 'border-muted bg-white hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-foreground">{product.name}</p>
                      {product.description && <p className="text-sm text-foreground/50">{product.description}</p>}
                    </div>
                    <p className="font-extrabold text-primary text-lg">RM{product.price}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {products.length === 0 && (
            <div className="bg-muted/40 rounded-2xl p-4 text-center text-foreground/50 text-sm">
              No products available yet. Check back soon!
            </div>
          )}

          <button
            onClick={() => setStep('form')}
            disabled={!selectedDate || !selectedProduct}
            className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
          >
            Continue →
          </button>
        </div>
      )}

      {/* Step: Order Form */}
      {step === 'form' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('calendar')} className="text-foreground/40 hover:text-foreground">← Back</button>
            <h2 className="font-bold text-foreground">Your Details</h2>
          </div>

          {/* Summary */}
          <div className="bg-primary/5 rounded-2xl p-4 border border-primary/20 space-y-1">
            <p className="text-sm font-bold text-primary">{selectedProduct?.name}</p>
            <p className="text-xs text-foreground/60">
              📅 {formatDate(selectedDate)}
            </p>
          </div>

          <div className="space-y-4">
            <InputField label="Full Name *" placeholder="e.g. Siti Aminah" value={form.customer_name} onChange={v => setForm({ ...form, customer_name: v })} />
            <InputField label="Phone Number *" placeholder="0123456789" value={form.customer_phone} onChange={v => setForm({ ...form, customer_phone: v })} type="tel" />
            <div>
              <label className="text-sm font-semibold text-foreground/70 block mb-2">Delivery Address *</label>
              <textarea rows={2} value={form.customer_address} onChange={e => setForm({ ...form, customer_address: e.target.value })}
                placeholder="Full delivery address..."
                className="w-full px-4 py-3 rounded-2xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-sm resize-none" />
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground/70 block mb-2">Quantity</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setForm({ ...form, quantity: Math.max(1, form.quantity - 1) })} className="w-12 h-12 rounded-2xl bg-muted text-xl font-bold">−</button>
                <span className="text-2xl font-extrabold text-foreground w-8 text-center">{form.quantity}</span>
                <button onClick={() => setForm({ ...form, quantity: form.quantity + 1 })} className="w-12 h-12 rounded-2xl bg-muted text-xl font-bold">+</button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground/70 block mb-2">Special Notes (optional)</label>
              <textarea rows={2} value={form.special_notes} onChange={e => setForm({ ...form, special_notes: e.target.value })}
                placeholder="e.g. Allergens, dedications, custom designs..."
                className="w-full px-4 py-3 rounded-2xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-sm resize-none" />
            </div>
          </div>

          {/* Order Summary */}
          {selectedProduct && (
            <div className="bg-white rounded-2xl border border-muted p-4 space-y-2">
              <p className="font-bold text-sm">Order Summary</p>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">{selectedProduct.name} × {form.quantity}</span>
                <span>RM {(selectedProduct.price * form.quantity).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-foreground/60">Delivery</span>
                <span>RM 10.00</span>
              </div>
              <div className="flex justify-between font-bold text-primary border-t border-muted pt-2">
                <span>Total</span>
                <span>RM {(selectedProduct.price * form.quantity + 10).toFixed(2)}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => setStep('payment')}
            disabled={!form.customer_name || !form.customer_phone || !form.customer_address}
            className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 disabled:scale-100"
          >
            Choose Payment →
          </button>
        </div>
      )}

      {/* Step: Payment */}
      {step === 'payment' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('form')} className="text-foreground/40 hover:text-foreground">← Back</button>
            <h2 className="font-bold text-foreground">Payment Method</h2>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => setForm({ ...form, payment_method: 'manual_transfer' })}
              className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                form.payment_method === 'manual_transfer' ? 'border-primary bg-primary/5' : 'border-muted bg-white'
              }`}
            >
              <p className="font-bold">🏦 Bank Transfer</p>
              <p className="text-sm text-foreground/60 mt-0.5">Transfer to baker&apos;s account & upload receipt</p>
            </button>

            <button
              onClick={() => setForm({ ...form, payment_method: 'cod' })}
              className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${
                form.payment_method === 'cod' ? 'border-primary bg-primary/5' : 'border-muted bg-white'
              }`}
            >
              <p className="font-bold">💵 Cash on Delivery</p>
              <p className="text-sm text-foreground/60 mt-0.5">Pay cash when order arrives</p>
            </button>
          </div>

          {form.payment_method === 'manual_transfer' && bakerInfo && (
            <div className="bg-muted/40 rounded-2xl p-4 space-y-2">
              <p className="font-bold text-sm">Bank Details</p>
              <div className="space-y-1 text-sm">
                <p><span className="text-foreground/50">Bank:</span> <span className="font-bold">{bakerInfo.bank_name || '—'}</span></p>
                <p><span className="text-foreground/50">Account:</span> <span className="font-bold">{bakerInfo.bank_account || '—'}</span></p>
                <p><span className="text-foreground/50">Name:</span> <span className="font-bold">{bakerInfo.bank_holder || '—'}</span></p>
              </div>
              <p className="text-xs text-foreground/50">Transfer within 24 hours to secure your slot.</p>
            </div>
          )}

          <button
            onClick={handleSubmitOrder}
            disabled={submitting}
            className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60"
          >
            {submitting ? 'Submitting...' : '🎉 Confirm Order'}
          </button>
        </div>
      )}

      {/* Step: Success */}
      {step === 'success' && (
        <div className="text-center space-y-6 py-8">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto text-5xl">
            🎂
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-foreground">Order Placed!</h2>
            <p className="text-foreground/60">Your order has been received.</p>
            <div className="bg-primary/5 rounded-2xl p-4 inline-block mt-2">
              <p className="text-xs text-foreground/50 mb-1">Order Number</p>
              <p className="text-xl font-extrabold text-primary">{orderNumber}</p>
            </div>
          </div>

          {bakerInfo?.whatsapp_number && (
            <a
              href={`https://wa.me/60${bakerInfo.whatsapp_number.replace(/^0/, '')}?text=${encodeURIComponent(
                `Hi! I just placed an order (${orderNumber}) for ${selectedProduct?.name}. My name is ${form.customer_name}.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-14 bg-green-600 text-white rounded-2xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all"
            >
              💬 WhatsApp the Baker
            </a>
          )}

          <p className="text-foreground/40 text-sm">
            Baker will confirm your order via WhatsApp shortly. ❤️
          </p>
        </div>
      )}
    </div>
  );
}

function InputField({ label, placeholder, value, onChange, type = 'text' }: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground/70 block mb-2">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-12 px-4 rounded-2xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-sm transition-colors"
      />
    </div>
  );
}
