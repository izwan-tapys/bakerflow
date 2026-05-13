'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: 0 });

  const loadProducts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('products').select('*').eq('baker_id', user.id).order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const handleAddProduct = async () => {
    if (!form.name || form.price <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('products').insert({
      baker_id: user.id,
      name: form.name,
      description: form.description,
      price: form.price,
      is_active: true
    });

    setForm({ name: '', description: '', price: 0 });
    setShowAdd(false);
    loadProducts();
  };

  const toggleActive = async (product: Product) => {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id);
    loadProducts();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    loadProducts();
  };

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Menu 🧁</h1>
          <p className="text-foreground/50 text-sm">Manage your bakery catalog</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="h-10 px-4 bg-primary text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 hover:scale-105 transition-all">
          + Add Product
        </button>
      </div>

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-muted p-5 space-y-4">
          <p className="font-bold text-sm">Add New Product</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground/70 block mb-1">Product Name</label>
              <input placeholder="e.g. Chocolate Moist Cake" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground/70 block mb-1">Description</label>
              <textarea placeholder="e.g. Rich chocolate cake with premium ganache..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                className="w-full py-2 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground/70 block mb-1">Price (RM)</label>
              <input type="number" placeholder="0.00" value={form.price || ''} onChange={e => setForm({ ...form, price: +e.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 h-11 rounded-xl border border-muted text-sm font-medium hover:bg-muted/50">Cancel</button>
            <button onClick={handleAddProduct} disabled={!form.name || form.price <= 0} className="flex-1 h-11 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50">Save Product</button>
          </div>
        </div>
      )}

      {/* Product List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded-2xl animate-pulse" />)}</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-muted mt-4">
          <div className="text-5xl mb-3">🍩</div>
          <p className="font-bold text-foreground">Your menu is empty</p>
          <p className="text-foreground/50 text-sm mt-1 mb-4">Add your first product to start taking orders.</p>
          <button onClick={() => setShowAdd(true)} className="h-10 px-6 bg-primary/10 text-primary rounded-xl font-bold text-sm hover:bg-primary/20 transition-all">
            Add Product
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {products.map(product => (
            <div key={product.id} className={`bg-white rounded-2xl p-5 border-2 transition-all ${product.is_active ? 'border-muted/50' : 'border-muted/20 opacity-60'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-foreground">{product.name}</h3>
                    {!product.is_active && (
                      <span className="text-[10px] uppercase font-black bg-muted text-foreground/50 px-2 py-0.5 rounded-md">Draft</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground/60 mb-2">{product.description || <span className="italic text-foreground/30">No description</span>}</p>
                  <p className="font-extrabold text-primary text-lg">RM {product.price.toFixed(2)}</p>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  <button 
                    onClick={() => toggleActive(product)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold w-24 transition-colors ${product.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-muted text-foreground/60 hover:bg-muted/80'}`}
                  >
                    {product.is_active ? '✅ Active' : '❌ Hidden'}
                  </button>
                  <button 
                    onClick={() => deleteProduct(product.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 w-24"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
