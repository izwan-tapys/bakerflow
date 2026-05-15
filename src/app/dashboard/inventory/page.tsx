'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { KitchenTabs } from '@/components/dashboard/KitchenTabs';
import { formatDate } from '@/lib/utils';

type IngredientType = 'raw' | 'component' | 'supply';

interface Ingredient {
  id: string;
  name: string;
  brand?: string | null;
  type: IngredientType;
  unit: string;
  current_stock: number;
  avg_cost_per_unit: number;
  low_stock_threshold: number;
  pack_size?: number | null;
  pack_unit?: string | null;
  pack_size_unit?: string | null;
  category?: string | null;
}

interface ShoppingItem {
  ingredient: Ingredient;
  needed: number;
  shortfall: number;
}

interface PurchaseRecord {
  id: string;
  ingredient_name: string;
  quantity: number;
  unit: string;
  total_cost: number;
  purchased_at: string;
}

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState<IngredientType | 'purchases'>('raw');
  
  // Modal States
  const [showAdd, setShowAdd] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  
  // Form State for Add Ingredient
  const [form, setForm] = useState({ 
    name: '', 
    brand: '', 
    type: 'raw' as IngredientType, 
    unit: 'g', 
    current_stock: 0, 
    category: 'Lain-lain' 
  });

  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const CATEGORIES = ['Semua', 'Tepung', 'Tenusu', 'Gula', 'Lemak', 'Hiasan', 'Packaging', 'Lain-lain'];

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setLoading(true);
    const [ingRes, ordersRes, recipesRes, purchasesRes] = await Promise.all([
      supabase.from('ingredients').select('*').eq('baker_id', user.id).order('name'),
      supabase.from('orders').select('product_id, quantity').eq('baker_id', user.id).in('status', ['pending', 'approved', 'production']),
      supabase.from('recipes').select('*').eq('baker_id', user.id),
      supabase.from('ingredient_purchases').select('*, ingredients(name)').eq('baker_id', user.id).order('purchased_at', { ascending: false }).limit(50)
    ]);

    const loadedIngredients = (ingRes.data || []).map(ing => ({
      ...ing,
      type: ing.type || 'raw'
    })) as Ingredient[];
    
    const activeOrders = ordersRes.data || [];
    const allRecipes = recipesRes.data || [];
    const rawPurchases = purchasesRes.data || [];

    // Calculate Shopping List
    const requiredMap = new Map<string, number>();
    activeOrders.forEach(order => {
      if (!order.product_id) return;
      const orderRecipes = allRecipes.filter(r => r.product_id === order.product_id);
      orderRecipes.forEach(recipe => {
        const current = requiredMap.get(recipe.ingredient_id) || 0;
        requiredMap.set(recipe.ingredient_id, current + (recipe.quantity_needed * order.quantity));
      });
    });

    const newShoppingList: ShoppingItem[] = [];
    loadedIngredients.forEach(ing => {
      const needed = requiredMap.get(ing.id) || 0;
      if (needed > 0 && ing.current_stock < needed) {
        newShoppingList.push({
          ingredient: ing,
          needed,
          shortfall: needed - ing.current_stock
        });
      }
    });

    setShoppingList(newShoppingList);
    setIngredients(loadedIngredients);
    setPurchases(rawPurchases.map(p => ({
      id: p.id,
      ingredient_name: p.ingredients?.name || 'Unknown',
      quantity: p.quantity,
      unit: p.unit || '',
      total_cost: p.total_cost,
      purchased_at: p.purchased_at
    })));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const getAutoCategory = (name: string): string => {
    const n = name.toLowerCase();
    if (n.includes('tepung') || n.includes('flour')) return 'Tepung';
    if (n.includes('susu') || n.includes('milk') || n.includes('cheese') || n.includes('keju') || n.includes('cream') || n.includes('yogurt')) return 'Tenusu';
    if (n.includes('gula') || n.includes('sugar') || n.includes('pemanis') || n.includes('honey')) return 'Gula';
    if (n.includes('mentega') || n.includes('butter') || n.includes('minyak') || n.includes('oil') || n.includes('margarine')) return 'Lemak';
    if (n.includes('box') || n.includes('kotak') || n.includes('plastic') || n.includes('bekas') || n.includes('packaging')) return 'Packaging';
    if (n.includes('coklat') || n.includes('chocolate') || n.includes('hiasan') || n.includes('sprinkle') || n.includes('topping')) return 'Hiasan';
    return 'Lain-lain';
  };

  const handleAddIngredient = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const autoCat = getAutoCategory(form.name);
    const { error } = await supabase.from('ingredients').insert({ 
      baker_id: user.id,
      name: form.name,
      brand: form.brand || null,
      type: form.type,
      unit: form.unit,
      current_stock: form.current_stock,
      category: form.type === 'supply' ? 'Packaging' : (form.category === 'Lain-lain' ? autoCat : form.category),
      low_stock_threshold: form.unit === 'kg' || form.unit === 'L' ? 1 : 100
    });

    if (error) alert(error.message);
    else {
      setShowAdd(false);
      setForm({ name: '', brand: '', type: 'raw', unit: 'g', current_stock: 0, category: 'Lain-lain' });
      loadData();
    }
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this?')) return;
    const { error } = await supabase.from('ingredients').delete().eq('id', id);
    if (error) alert(error.message);
    else loadData();
  };

  const handleRestock = async (ing: Ingredient, qty: number, totalCost: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newStock = Number(ing.current_stock) + Number(qty);
    const newTotalCost = (Number(ing.current_stock) * Number(ing.avg_cost_per_unit)) + Number(totalCost);
    const newAvgCost = newTotalCost / newStock;

    const { error: ingError } = await supabase.from('ingredients').update({
      current_stock: newStock,
      avg_cost_per_unit: newAvgCost
    }).eq('id', ing.id);

    if (ingError) throw ingError;

    const { error: purchaseError } = await supabase.from('ingredient_purchases').insert({
      baker_id: user.id,
      ingredient_id: ing.id,
      quantity: qty,
      unit_cost: totalCost / qty,
      total_cost: totalCost
    });

    if (purchaseError) throw purchaseError;
    loadData();
  };

  const handleUpdateInfo = async (ing: Ingredient, updates: any) => {
    const { error } = await supabase.from('ingredients').update(updates).eq('id', ing.id);
    if (error) throw error;
    loadData();
  };

  const filteredIngredients = ingredients.filter(i => {
    // First filter by active tab type
    if (activeMainTab !== 'purchases' && i.type !== activeMainTab) return false;
    
    // Then filter by sub-category
    if (selectedCategory === 'Semua') return true;
    return i.category === selectedCategory;
  });

  const handleShareWhatsApp = () => {
    if (shoppingList.length === 0) return;
    let message = `🛒 *SHOPPING LIST - BAKERFLOW*\n\n`;
    shoppingList.forEach((item, idx) => {
      let packInfo = '';
      if (item.ingredient.pack_size) {
        let sizeInBase = item.ingredient.pack_size;
        if ((item.ingredient.pack_size_unit === 'kg' && item.ingredient.unit === 'g') || 
            (item.ingredient.pack_size_unit === 'L' && item.ingredient.unit === 'ml')) {
          sizeInBase = item.ingredient.pack_size * 1000;
        }
        const packs = Math.ceil(item.shortfall / sizeInBase);
        packInfo = `${packs} ${item.ingredient.pack_unit || 'pek'} `;
      }
      message += `${idx + 1}. *${item.ingredient.name}*: ${packInfo}(${item.shortfall.toFixed(0)}${item.ingredient.unit})\n`;
    });
    message += `\nJom restock! 🧁`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  return (
    <div className="space-y-6 pb-4">
      <KitchenTabs />

      {/* Main Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Inventory</h1>
          <p className="text-foreground/50 text-sm font-medium">Manage your kitchen resources</p>
        </div>
        <button 
          onClick={() => {
            setForm({ ...form, type: activeMainTab === 'purchases' ? 'raw' : activeMainTab });
            setShowAdd(true);
          }} 
          className="h-12 px-6 bg-primary text-white rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95"
        >
          + Add Item
        </button>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex bg-muted/30 p-1.5 rounded-[24px] border border-muted/50">
        {[
          { id: 'raw', label: 'Raw Ingredients', icon: '🥣' },
          { id: 'component', label: 'Components', icon: '🍰' },
          { id: 'supply', label: 'Supplies', icon: '📦' },
          { id: 'purchases', label: 'Purchases', icon: '🧾' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveMainTab(tab.id as any);
              setSelectedCategory('Semua');
            }}
            className={`flex-1 flex flex-col items-center justify-center py-3 rounded-2xl transition-all ${
              activeMainTab === tab.id 
                ? 'bg-white text-primary shadow-sm border border-muted/50' 
                : 'text-foreground/40 hover:text-foreground/60'
            }`}
          >
            <span className="text-lg mb-1">{tab.icon}</span>
            <span className="text-[10px] font-black uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Shopping List Banner */}
      {shoppingList.length > 0 && activeMainTab !== 'purchases' && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-[32px] p-5 space-y-4 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 text-4xl rotate-12">🛒</div>
          <div className="flex items-center justify-between relative z-10">
            <div>
              <p className="font-black text-orange-800 flex items-center gap-2">
                Shopping List 
                <span className="bg-orange-200 text-orange-800 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                  {shoppingList.length} ITEMS
                </span>
              </p>
              <p className="text-[11px] text-orange-700/60 font-bold mt-0.5">Ingredients needed for active orders</p>
            </div>
            <button 
              onClick={handleShareWhatsApp}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl text-xs font-black hover:bg-green-600 transition-all shadow-md shadow-green-500/20"
            >
              <span>💬</span> WhatsApp List
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar relative z-10">
            {shoppingList.map(item => {
              let packs = null;
              if (item.ingredient.pack_size) {
                let sizeInBase = item.ingredient.pack_size;
                if ((item.ingredient.pack_size_unit === 'kg' && item.ingredient.unit === 'g') || 
                    (item.ingredient.pack_size_unit === 'L' && item.ingredient.unit === 'ml')) {
                  sizeInBase = item.ingredient.pack_size * 1000;
                }
                packs = Math.ceil(item.shortfall / sizeInBase);
              }
              return (
                <div key={item.ingredient.id} onClick={() => setSelectedIngredient(item.ingredient)} className="flex-none bg-white p-3 rounded-2xl border border-orange-200 cursor-pointer hover:border-orange-400 transition-all shadow-sm active:scale-95">
                  <p className="font-black text-xs text-orange-900">{item.ingredient.name}</p>
                  <p className="text-[10px] font-bold text-orange-600 mt-0.5">
                    {packs ? `${packs} ${item.ingredient.pack_unit || 'pek'} ` : ''}
                    ({item.shortfall.toFixed(0)}{item.ingredient.unit})
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Purchases Tab Content */}
      {activeMainTab === 'purchases' ? (
        <div className="bg-white rounded-[32px] border border-muted overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/30">
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest">Item</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right">Qty</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/50">
                {purchases.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-20 text-center text-foreground/30 font-bold italic">No purchase history yet.</td></tr>
                ) : (
                  purchases.map(p => (
                    <tr key={p.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold text-foreground/60">{formatDate(p.purchased_at)}</td>
                      <td className="px-6 py-4 text-sm font-black text-foreground">{p.ingredient_name}</td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-foreground/70">{p.quantity}{p.unit}</td>
                      <td className="px-6 py-4 text-right text-sm font-black text-primary">RM {p.total_cost.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Sub-Category Filter (Only for Raw & Supplies) */}
          {(activeMainTab === 'raw' || activeMainTab === 'supply') && (
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedCategory(c)}
                  className={`px-5 py-2.5 rounded-full text-[11px] font-black transition-all whitespace-nowrap border-2 ${
                    selectedCategory === c 
                      ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105' 
                      : 'bg-white border-muted text-foreground/40 hover:border-primary/30'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {/* Ingredients List Table */}
          <div className="bg-white rounded-[32px] border border-muted overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30">
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest">Item</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right">Stock</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right">Avg Cost</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-center w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-muted/50">
                  {loading ? (
                    [1,2,3,4,5].map(i => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-6 py-5"><div className="h-4 bg-muted rounded w-32" /></td>
                        <td className="px-6 py-5 text-right"><div className="h-4 bg-muted rounded w-16 ml-auto" /></td>
                        <td className="px-6 py-5 text-right"><div className="h-4 bg-muted rounded w-20 ml-auto" /></td>
                      </tr>
                    ))
                  ) : filteredIngredients.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-24 text-center text-foreground/30 font-bold italic">
                        <div className="text-3xl mb-2">🔭</div>
                        No items found in this section.
                      </td>
                    </tr>
                  ) : (
                    filteredIngredients.map(ing => {
                      const committed = shoppingList.find(s => s.ingredient.id === ing.id)?.needed || 0;
                      const available = ing.current_stock - committed;
                      const isLow = available <= ing.low_stock_threshold;
                      const isNegative = available < 0;
                      
                      return (
                        <tr 
                          key={ing.id} 
                          onClick={() => setSelectedIngredient(ing)}
                          className="hover:bg-primary/[0.02] cursor-pointer transition-colors active:bg-primary/[0.05]"
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-bold text-foreground text-sm">{ing.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  {ing.brand && <span className="text-[9px] font-black text-primary/60 bg-primary/5 px-1.5 py-0.5 rounded uppercase tracking-tighter">@{ing.brand}</span>}
                                  <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-tighter">{ing.category}</span>
                                </div>
                              </div>
                              {isLow && !isNegative && <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" title="Low Stock" />}
                              {isNegative && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Insufficient Stock" />}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex flex-col items-end">
                              <p className={`font-black text-sm ${isNegative ? 'text-red-600' : isLow ? 'text-orange-500' : 'text-foreground/80'}`}>
                                {available.toLocaleString()}<span className="text-[10px] font-bold ml-0.5 opacity-40">{ing.unit}</span>
                              </p>
                              {committed > 0 && (
                                <p className="text-[9px] font-black text-foreground/20 uppercase tracking-tighter">
                                  On Hand: {ing.current_stock}{ing.unit}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <p className="text-sm font-black text-primary/80">RM {ing.avg_cost_per_unit.toFixed(2)}</p>
                            <p className="text-[9px] font-bold text-foreground/30 uppercase tracking-tighter">Per {ing.unit}</p>
                          </td>
                          <td className="px-6 py-5 text-center">
                            <div className="w-8 h-8 flex items-center justify-center rounded-full bg-muted/30 text-foreground/20 text-xs">
                              ›
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal Components */}
      {showAdd && (
        <AddIngredientModal 
          isOpen={showAdd} 
          onClose={() => setShowAdd(false)} 
          onAdd={handleAddIngredient}
          form={form}
          setForm={setForm}
          categories={CATEGORIES}
          getAutoCategory={getAutoCategory}
        />
      )}

      {selectedIngredient && (
        <IngredientActionModal 
          ingredient={selectedIngredient}
          onClose={() => setSelectedIngredient(null)}
          onRestock={handleRestock}
          onUpdate={handleUpdateInfo}
          onDelete={handleDeleteIngredient}
        />
      )}
    </div>
  );
}

// Sub-components for better organization
function AddIngredientModal({ isOpen, onClose, onAdd, form, setForm, categories, getAutoCategory }: any) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full max-w-md md:rounded-[40px] rounded-t-[40px] p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center mb-8 flex-none">
          <div>
            <h2 className="text-2xl font-black text-primary tracking-tight">New Item</h2>
            <p className="text-xs text-foreground/40 font-bold uppercase tracking-widest mt-1">Add to {form.type} inventory</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-muted rounded-full text-foreground/40 text-2xl font-bold hover:bg-muted/80 transition-colors">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-6">
          <div className="space-y-5">
            <div>
              <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Type</label>
              <div className="flex bg-muted/40 p-1 rounded-xl">
                {['raw', 'component', 'supply'].map(t => (
                  <button
                    key={t}
                    onClick={() => setForm({ ...form, type: t })}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                      form.type === t ? 'bg-white text-primary shadow-sm' : 'text-foreground/30'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Item Name</label>
              <input 
                placeholder="e.g. Premium Flour" 
                value={form.name} 
                onChange={e => {
                  const name = e.target.value;
                  setForm({ ...form, name, category: getAutoCategory(name) });
                }}
                className="w-full h-14 px-5 rounded-2xl border-2 border-muted focus:border-primary outline-none font-bold text-lg transition-all" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Brand (Opt)</label>
                <input 
                  placeholder="Anchor" 
                  value={form.brand} 
                  onChange={e => setForm({ ...form, brand: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold shadow-sm" 
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none bg-white font-bold text-sm shadow-sm">
                  {categories.filter((c: string) => c !== 'Semua').map((c: string) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Base Unit</label>
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none bg-white font-bold text-sm shadow-sm">
                  {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Initial Stock</label>
                <input type="number" placeholder="0" value={form.current_stock || ''} onChange={e => setForm({ ...form, current_stock: +e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold shadow-sm" />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 pb-10 md:pb-0 flex-none">
          <button onClick={onAdd} className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xl shadow-xl shadow-primary/20 active:scale-95 transition-all">
            Create {form.type}
          </button>
        </div>
      </div>
    </div>
  );
}

function IngredientActionModal({ ingredient, onClose, onRestock, onUpdate, onDelete }: any) {
  const [tab, setTab] = useState<'restock' | 'recipe' | 'edit'>(ingredient.type === 'component' ? 'recipe' : 'restock');
  const [loading, setLoading] = useState(false);

  // Restock State
  const [qtyInput, setQtyInput] = useState<number | ''>('');
  const [purchaseUnit, setPurchaseUnit] = useState(ingredient.unit);
  const [totalPrice, setTotalPrice] = useState<number | ''>('');
  const [isBulk, setIsBulk] = useState(!!ingredient.pack_size);
  const [numPacks, setNumPacks] = useState<number | ''>('');
  const [packSize, setPackSize] = useState<number | ''>(ingredient.pack_size ?? '');
  const [packSizeUnit, setPackSizeUnit] = useState(ingredient.pack_size_unit ?? ingredient.unit);
  const [pricePerPack, setPricePerPack] = useState<number | ''>('');

  // Edit State
  const [editForm, setEditForm] = useState({
    name: ingredient.name,
    unit: ingredient.unit,
    category: ingredient.category || 'Lain-lain',
    current_stock: ingredient.current_stock,
    low_stock_threshold: ingredient.low_stock_threshold,
    brand: ingredient.brand || '',
    pack_size: ingredient.pack_size ?? '' as number | '',
    pack_unit: ingredient.pack_unit ?? '',
    pack_size_unit: ingredient.pack_size_unit ?? ingredient.unit,
  });

  // Recipe/Component State
  const [subRecipes, setSubRecipes] = useState<any[]>([]);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [recipeForm, setRecipeForm] = useState({ ingredient_id: '', quantity_needed: 0 });

  useEffect(() => {
    if (tab === 'recipe') {
      loadRecipeData();
    }
  }, [tab]);

  const loadRecipeData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const [recipeRes, ingRes] = await Promise.all([
      supabase.from('recipes').select('*, ingredients(*)').eq('parent_ingredient_id', ingredient.id),
      supabase.from('ingredients').select('*').eq('baker_id', user?.id).eq('type', 'raw').order('name')
    ]);
    setSubRecipes(recipeRes.data || []);
    setAllIngredients(ingRes.data || []);
  };

  const handleAddSubIngredient = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('recipes').insert({
      baker_id: user?.id,
      parent_ingredient_id: ingredient.id,
      ingredient_id: recipeForm.ingredient_id,
      quantity_needed: recipeForm.quantity_needed
    });
    if (error) alert(error.message);
    else {
      setRecipeForm({ ingredient_id: '', quantity_needed: 0 });
      loadRecipeData();
    }
  };

  const handleRemoveSubIngredient = async (id: string) => {
    await supabase.from('recipes').delete().eq('id', id);
    loadRecipeData();
  };

  const handleRestockSubmit = async () => {
    setLoading(true);
    try {
      let finalQty = Number(isBulk ? (numPacks || 0) * (packSize || 0) : qtyInput);
      let finalTotal = Number(isBulk ? (numPacks || 0) * (pricePerPack || 0) : totalPrice);

      // Unit conversion for qty
      const activeUnit = isBulk ? packSizeUnit : purchaseUnit;
      if (activeUnit === 'kg' && ingredient.unit === 'g') finalQty *= 1000;
      else if (activeUnit === 'g' && ingredient.unit === 'kg') finalQty /= 1000;
      else if (activeUnit === 'L' && ingredient.unit === 'ml') finalQty *= 1000;
      else if (activeUnit === 'ml' && ingredient.unit === 'L') finalQty /= 1000;

      await onRestock(ingredient, finalQty, finalTotal);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async () => {
    setLoading(true);
    try {
      await onUpdate(ingredient, editForm);
      onClose();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full max-w-md md:rounded-[40px] rounded-t-[40px] p-8 shadow-2xl flex flex-col max-h-[95vh] md:max-h-[85vh] overflow-hidden">
        <div className="flex justify-between items-start flex-none mb-6">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">{ingredient.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                ingredient.type === 'component' ? 'bg-purple-100 text-purple-600' : 
                ingredient.type === 'supply' ? 'bg-blue-100 text-blue-600' : 'bg-primary/10 text-primary'
              }`}>
                {ingredient.type}
              </span>
              <p className="text-[11px] font-bold text-foreground/40 italic">
                Stock: {ingredient.current_stock}{ingredient.unit}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-muted rounded-full text-foreground/40 text-2xl font-bold hover:bg-muted/80 transition-colors">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex bg-muted/40 p-1.5 rounded-2xl flex-none mb-6 border border-muted/50">
          {ingredient.type === 'component' && (
            <button onClick={() => setTab('recipe')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${tab === 'recipe' ? 'bg-white text-primary shadow-sm' : 'text-foreground/40'}`}>🍳 Recipe</button>
          )}
          <button onClick={() => setTab('restock')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${tab === 'restock' ? 'bg-white text-primary shadow-sm' : 'text-foreground/40'}`}>🚚 {ingredient.type === 'component' ? 'Produce' : 'Restock'}</button>
          <button onClick={() => setTab('edit')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${tab === 'edit' ? 'bg-white text-primary shadow-sm' : 'text-foreground/40'}`}>⚙️ Edit</button>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
          {tab === 'recipe' ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-foreground/30 tracking-widest px-1">Sub-Ingredients</p>
                {subRecipes.length === 0 ? (
                  <div className="text-center py-8 bg-muted/20 rounded-2xl border-2 border-dashed border-muted/50">
                    <p className="text-xs font-bold text-foreground/30">No ingredients in recipe yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {subRecipes.map(r => (
                      <div key={r.id} className="flex justify-between items-center bg-white border border-muted/50 p-3 rounded-xl shadow-sm">
                        <div>
                          <p className="text-sm font-black text-foreground">{r.ingredients?.name}</p>
                          <p className="text-[10px] font-bold text-foreground/40">{r.quantity_needed}{r.ingredients?.unit}</p>
                        </div>
                        <button onClick={() => handleRemoveSubIngredient(r.id)} className="text-red-300 hover:text-red-600 p-2">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-3">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">Add To Recipe</p>
                <div className="grid grid-cols-2 gap-2">
                  <select 
                    value={recipeForm.ingredient_id} 
                    onChange={e => setRecipeForm({...recipeForm, ingredient_id: e.target.value})}
                    className="col-span-2 h-11 px-3 rounded-xl border border-muted text-sm font-bold bg-white"
                  >
                    <option value="">Select ingredient...</option>
                    {allIngredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input 
                    type="number" 
                    placeholder="Qty" 
                    value={recipeForm.quantity_needed || ''} 
                    onChange={e => setRecipeForm({...recipeForm, quantity_needed: +e.target.value})}
                    className="h-11 px-3 rounded-xl border border-muted text-sm font-bold"
                  />
                  <button 
                    onClick={handleAddSubIngredient}
                    disabled={!recipeForm.ingredient_id || !recipeForm.quantity_needed}
                    className="h-11 bg-primary text-white rounded-xl font-black text-xs uppercase disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ) : tab === 'restock' ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center px-1">
                <p className="text-[10px] font-black uppercase text-foreground/30 tracking-widest">
                  {ingredient.type === 'component' ? 'Manual Adjustment' : 'Restock Record'}
                </p>
                {ingredient.type !== 'component' && (
                  <button onClick={() => setIsBulk(!isBulk)} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all shadow-sm ${isBulk ? 'bg-primary text-white' : 'bg-muted text-foreground/40'}`}>
                    {isBulk ? '📦 Bulk Mode' : '⚖️ Single Unit'}
                  </button>
                )}
              </div>

              {isBulk ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 bg-muted/20 p-5 rounded-3xl border border-muted/50">
                    <div>
                      <label className="text-[10px] font-black text-foreground/40 uppercase mb-1.5 block">Num Packs</label>
                      <input type="number" placeholder="10" value={numPacks} onChange={e => setNumPacks(e.target.value === '' ? '' : +e.target.value)}
                        className="w-full h-12 px-3 rounded-xl border border-muted text-sm font-black focus:border-primary outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-foreground/40 uppercase mb-1.5 block">Size Each</label>
                      <input type="number" placeholder="1" value={packSize} onChange={e => setPackSize(e.target.value === '' ? '' : +e.target.value)}
                        className="w-full h-12 px-3 rounded-xl border border-muted text-sm font-black focus:border-primary outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-foreground/40 uppercase mb-1.5 block">Unit</label>
                      <select value={packSizeUnit} onChange={e => setPackSizeUnit(e.target.value)}
                        className="w-full h-12 px-2 rounded-xl border border-muted text-xs font-black bg-white focus:border-primary">
                        {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3">
                      <label className="text-[10px] font-black text-foreground/40 uppercase mb-1.5 block">Total Price (RM)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/30">RM</span>
                        <input type="number" placeholder="0.00" value={pricePerPack} onChange={e => setPricePerPack(e.target.value === '' ? '' : +e.target.value)}
                          className="w-full h-12 pl-12 pr-4 rounded-xl border border-muted text-sm font-black focus:border-primary outline-none" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <div className="w-24">
                    <label className="text-[10px] font-black text-foreground/40 uppercase mb-1.5 block">Qty</label>
                    <input type="number" placeholder="0" value={qtyInput} onChange={e => setQtyInput(e.target.value === '' ? '' : +e.target.value)}
                      className="w-full h-14 px-3 rounded-2xl border border-muted text-lg font-black text-center focus:border-primary outline-none" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-black text-foreground/40 uppercase mb-1.5 block">Total Price (RM)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/30">RM</span>
                      <input type="number" placeholder="0.00" value={totalPrice} onChange={e => setTotalPrice(e.target.value === '' ? '' : +e.target.value)}
                        className="w-full h-14 pl-12 pr-4 rounded-2xl border border-muted text-lg font-black focus:border-primary outline-none" />
                    </div>
                  </div>
                </div>
              )}

              <button 
                onClick={handleRestockSubmit} 
                disabled={loading || (!qtyInput && !numPacks)} 
                className="w-full h-14 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                {loading ? 'Recording...' : ingredient.type === 'component' ? 'Adjust Stock' : 'Record Purchase'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-foreground/40 uppercase mb-1.5 block tracking-widest">Name</label>
                  <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                    className="w-full h-12 px-4 rounded-xl border-2 border-muted font-bold focus:border-primary outline-none bg-white" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-foreground/40 uppercase mb-1.5 block tracking-widest">Base Unit</label>
                  <select value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})}
                    className="w-full h-12 px-4 rounded-xl border-2 border-muted font-bold bg-white focus:border-primary">
                    {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-foreground/40 uppercase mb-1.5 block tracking-widest">Category</label>
                  <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none bg-white font-bold text-sm">
                    {['Tepung', 'Tenusu', 'Gula', 'Lemak', 'Hiasan', 'Packaging', 'Lain-lain'].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="bg-muted/30 p-5 rounded-3xl space-y-4">
                <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest">Alerts & Packaging</p>
                <div>
                  <label className="text-[10px] font-black text-foreground/40 mb-1 block">Low Stock Threshold</label>
                  <input type="number" value={editForm.low_stock_threshold} onChange={e => setEditForm({...editForm, low_stock_threshold: +e.target.value})}
                    className="w-full h-11 px-4 rounded-xl border border-muted font-bold focus:border-primary outline-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-foreground/40 mb-1 block">Pack Size</label>
                    <input type="number" placeholder="1" value={editForm.pack_size} onChange={e => setEditForm({...editForm, pack_size: e.target.value === '' ? '' : +e.target.value})}
                      className="w-full h-11 px-4 rounded-xl border border-muted font-bold focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-foreground/40 mb-1 block">Pack Unit Name</label>
                    <input placeholder="pek/botol" value={editForm.pack_unit} onChange={e => setEditForm({...editForm, pack_unit: e.target.value})}
                      className="w-full h-11 px-4 rounded-xl border border-muted font-bold focus:border-primary outline-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <button onClick={handleEditSubmit} disabled={loading} className="w-full h-14 bg-foreground text-white rounded-2xl font-black shadow-lg active:scale-95 transition-all">
                  {loading ? 'Updating...' : 'Update Details'}
                </button>
                <button onClick={() => onDelete(ingredient.id)} className="w-full h-10 text-red-500 font-bold text-xs hover:bg-red-50 rounded-xl transition-colors">
                  Hapus Item Dari Inventori
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
