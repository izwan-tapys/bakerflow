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
  sku?: string | null;
  shelf_life?: number | null;
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
    category: 'Lain-lain',
    sku: '',
    shelf_life: '' as number | '',
    pack_size: '' as number | '',
    pack_unit: '',
    pack_size_unit: 'g',
    low_stock_threshold: 10
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

  const handleAddIngredient = async (formData: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { error } = await supabase.from('ingredients').insert({ 
      baker_id: user.id,
      ...formData,
      sku: formData.sku || null,
      shelf_life: formData.shelf_life || null,
      pack_size: formData.pack_size || null,
      pack_unit: formData.pack_unit || null,
      pack_size_unit: formData.pack_size_unit || null
    });

    if (error) alert(error.message);
    else {
      setShowAdd(false);
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
    if (activeMainTab !== 'purchases' && i.type !== activeMainTab) return false;
    if (selectedCategory === 'Semua') return true;
    return i.category === selectedCategory;
  });

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
            setForm({ 
              name: '', brand: '', type: activeMainTab === 'purchases' ? 'raw' : activeMainTab as IngredientType, 
              unit: 'g', current_stock: 0, category: 'Lain-lain',
              sku: '', shelf_life: '', pack_size: '', pack_unit: '', pack_size_unit: 'g',
              low_stock_threshold: 10
            });
            setShowAdd(true);
          }} 
          className="h-12 px-6 bg-primary text-white rounded-2xl font-black text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95"
        >
          + Add Item
        </button>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex bg-muted/30 p-1.5 rounded-[12px] border border-muted/50 overflow-x-auto no-scrollbar">
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
            className={`flex-1 min-w-[80px] flex flex-col items-center justify-center py-3 rounded-xl transition-all ${
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

      {/* List Views */}
      {activeMainTab === 'purchases' ? (
        <PurchasesList purchases={purchases} />
      ) : (
        <>
          <CategoryFilter 
            categories={CATEGORIES} 
            selected={selectedCategory} 
            onSelect={setSelectedCategory} 
            visible={activeMainTab === 'raw' || activeMainTab === 'supply'} 
          />
          <IngredientsList 
            ingredients={filteredIngredients} 
            onSelect={setSelectedIngredient} 
            loading={loading}
          />
        </>
      )}

      {/* Modals */}
      {showAdd && (
        <AddIngredientModal 
          onClose={() => setShowAdd(false)}
          onAdd={handleAddIngredient}
          initialForm={form}
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
          categories={CATEGORIES}
          getAutoCategory={getAutoCategory}
        />
      )}
    </div>
  );
}

// --- Sub-Components ---

function PurchasesList({ purchases }: { purchases: PurchaseRecord[] }) {
  return (
    <div className="bg-white rounded-[16px] border border-muted overflow-hidden shadow-sm">
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
  );
}

function CategoryFilter({ categories, selected, onSelect, visible }: any) {
  if (!visible) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
      {categories.map((c: string) => (
        <button
          key={c}
          onClick={() => onSelect(c)}
          className={`px-5 py-2.5 rounded-full text-[11px] font-black transition-all whitespace-nowrap border-2 ${
            selected === c 
              ? 'bg-primary border-primary text-white shadow-lg' 
              : 'bg-white border-muted text-foreground/40 hover:border-primary/30'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function IngredientsList({ ingredients, onSelect, loading }: any) {
  return (
    <div className="bg-white rounded-[16px] border border-muted overflow-hidden shadow-sm">
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
              [1,2,3].map(i => (
                <tr key={i} className="animate-pulse">
                  <td className="px-6 py-5"><div className="h-4 bg-muted rounded w-32" /></td>
                  <td className="px-6 py-5 text-right"><div className="h-4 bg-muted rounded w-16 ml-auto" /></td>
                  <td className="px-6 py-5 text-right"><div className="h-4 bg-muted rounded w-20 ml-auto" /></td>
                </tr>
              ))
            ) : ingredients.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-20 text-center text-foreground/30 font-bold italic text-sm">No items found.</td></tr>
            ) : (
              ingredients.map((ing: Ingredient) => (
                <tr 
                  key={ing.id} 
                  onClick={() => onSelect(ing)}
                  className="hover:bg-primary/[0.02] cursor-pointer transition-colors active:bg-primary/[0.05]"
                >
                  <td className="px-6 py-5">
                    <p className="font-bold text-foreground text-sm">{ing.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {ing.brand && <span className="text-[9px] font-black text-primary/60 bg-primary/5 px-1.5 py-0.5 rounded uppercase tracking-tighter">@{ing.brand}</span>}
                      <span className="text-[9px] font-bold text-foreground/30 uppercase tracking-tighter">{ing.category}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right font-black text-sm text-foreground/80">
                    {ing.current_stock}<span className="text-[10px] ml-0.5 opacity-40">{ing.unit}</span>
                  </td>
                  <td className="px-6 py-5 text-right font-black text-primary/80 text-sm">
                    RM {ing.avg_cost_per_unit.toFixed(2)}
                  </td>
                  <td className="px-6 py-5 text-center text-foreground/20">›</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IngredientForm({ data, setData, categories, getAutoCategory }: any) {
  return (
    <div className="space-y-8 pb-10">
      {/* Basic Info Section */}
      <section className="space-y-4">
        <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] border-b-2 border-primary/10 pb-2">Basic Information</p>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Type</label>
            <div className="flex bg-muted/40 p-1 rounded-xl">
              {['raw', 'component', 'supply'].map(t => (
                <button key={t} onClick={() => setData({ ...data, type: t })} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${data.type === t ? 'bg-white text-primary shadow-sm' : 'text-foreground/30'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Name</label>
            <input value={data.name} onChange={e => setData({ ...data, name: e.target.value, category: getAutoCategory(e.target.value) })}
              className="w-full h-14 px-5 rounded-2xl border-2 border-muted focus:border-primary outline-none font-bold text-lg transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Brand</label>
              <input value={data.brand} onChange={e => setData({ ...data, brand: e.target.value })} className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Category</label>
              <select value={data.category} onChange={e => setData({ ...data, category: e.target.value })} className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none bg-white font-bold text-sm">
                {categories.filter((c: string) => c !== 'Semua').map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* Purchasing Section */}
      <section className="space-y-4">
        <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] border-b-2 border-primary/10 pb-2">Purchasing Info</p>
        <div className="bg-blue-50/50 p-5 rounded-[32px] border border-blue-100 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-foreground/40 mb-1 block uppercase">Size 1 Pack</label>
              <input type="number" value={data.pack_size} onChange={e => setData({ ...data, pack_size: +e.target.value })} className="w-full h-11 px-4 rounded-xl border border-muted font-bold focus:border-primary outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-black text-foreground/40 mb-1 block uppercase">Pack Unit</label>
              <select value={data.pack_size_unit} onChange={e => setData({ ...data, pack_size_unit: e.target.value })} className="w-full h-11 px-3 rounded-xl border border-muted font-bold bg-white focus:border-primary">
                {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black text-foreground/40 mb-1 block uppercase">Pack Label (e.g. tin, bottle)</label>
              <input value={data.pack_unit} onChange={e => setData({ ...data, pack_unit: e.target.value })} className="w-full h-11 px-4 rounded-xl border border-muted font-bold focus:border-primary outline-none" />
            </div>
          </div>
        </div>
      </section>

      {/* Stock Section */}
      <section className="space-y-4">
        <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] border-b-2 border-primary/10 pb-2">Stock Info</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Base Unit</label>
            <select value={data.unit} onChange={e => setData({ ...data, unit: e.target.value })} className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none bg-white font-bold">
              {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Initial Stock</label>
            <input type="number" value={data.current_stock} onChange={e => setData({ ...data, current_stock: +e.target.value })} className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Low Stock Alert Threshold</label>
            <input type="number" value={data.low_stock_threshold} onChange={e => setData({ ...data, low_stock_threshold: +e.target.value })} className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
          </div>
        </div>
      </section>

      {/* Advance Section */}
      <section className="space-y-4">
        <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] border-b-2 border-primary/10 pb-2">Advanced</p>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">SKU / Code</label>
            <input value={data.sku} onChange={e => setData({ ...data, sku: e.target.value })} className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-foreground/40 mb-1.5 block tracking-widest">Shelf Life (Days)</label>
            <input type="number" value={data.shelf_life} onChange={e => setData({ ...data, shelf_life: +e.target.value })} className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
          </div>
        </div>
      </section>
    </div>
  );
}

function AddIngredientModal({ onClose, onAdd, initialForm, categories, getAutoCategory }: any) {
  const [formData, setFormData] = useState(initialForm);
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full max-w-md md:rounded-[20px] rounded-t-[20px] p-8 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center mb-8 flex-none">
          <h2 className="text-2xl font-black text-primary tracking-tight">New Item</h2>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center bg-muted rounded-full text-foreground/40 text-2xl font-bold hover:bg-muted/80 transition-colors">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          <IngredientForm data={formData} setData={setFormData} categories={categories} getAutoCategory={getAutoCategory} />
        </div>
        <div className="pt-6 flex-none">
          <button onClick={() => onAdd(formData)} className="w-full h-16 bg-primary text-white rounded-xl font-black text-lg shadow-xl shadow-primary/20 active:scale-95 transition-all">
            Create Ingredient
          </button>
        </div>
      </div>
    </div>
  );
}

function IngredientActionModal({ ingredient, onClose, onRestock, onUpdate, onDelete, categories, getAutoCategory }: any) {
  const [tab, setTab] = useState<'restock' | 'recipe' | 'edit'>(ingredient.type === 'component' ? 'recipe' : 'restock');
  const [loading, setLoading] = useState(false);
  const [editData, setEditData] = useState(ingredient);

  // Restock logic
  const [qtyInput, setQtyInput] = useState<number | ''>('');
  const [purchaseUnit, setPurchaseUnit] = useState(ingredient.unit);
  const [totalPrice, setTotalPrice] = useState<number | ''>('');
  const [isBulk, setIsBulk] = useState(!!ingredient.pack_size);
  const [numPacks, setNumPacks] = useState<number | ''>('');
  const [packSize, setPackSize] = useState<number | ''>(ingredient.pack_size ?? '');
  const [packSizeUnit, setPackSizeUnit] = useState(ingredient.pack_size_unit ?? ingredient.unit);
  const [pricePerPack, setPricePerPack] = useState<number | ''>('');

  // Component Recipe logic
  const [subRecipes, setSubRecipes] = useState<any[]>([]);
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [recipeForm, setRecipeForm] = useState({ ingredient_id: '', quantity_needed: 0 });

  useEffect(() => {
    if (tab === 'recipe') loadRecipeData();
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

  const handleRestockSubmit = async () => {
    setLoading(true);
    let finalQty = Number(isBulk ? (numPacks || 0) * (packSize || 0) : qtyInput);
    let finalTotal = Number(isBulk ? (numPacks || 0) * (pricePerPack || 0) : totalPrice);
    const activeUnit = isBulk ? packSizeUnit : purchaseUnit;
    if (activeUnit === 'kg' && ingredient.unit === 'g') finalQty *= 1000;
    else if (activeUnit === 'g' && ingredient.unit === 'kg') finalQty /= 1000;
    else if (activeUnit === 'L' && ingredient.unit === 'ml') finalQty *= 1000;
    else if (activeUnit === 'ml' && ingredient.unit === 'L') finalQty /= 1000;
    await onRestock(ingredient, finalQty, finalTotal);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
      <div className="bg-white w-full max-w-md md:rounded-[20px] rounded-t-[20px] p-8 shadow-2xl flex flex-col h-[95vh] md:h-auto md:max-h-[85vh] overflow-hidden">
        <div className="flex justify-between items-start mb-6 flex-none">
          <div>
            <h2 className="text-2xl font-black text-foreground tracking-tight">{ingredient.name}</h2>
            <p className="text-[10px] font-black text-foreground/30 uppercase tracking-widest">{ingredient.type}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-muted rounded-full text-foreground/40 text-2xl font-bold">&times;</button>
        </div>

        <div className="flex bg-muted/40 p-1.5 rounded-xl mb-6 flex-none border border-muted/50">
          {ingredient.type === 'component' && (
            <button onClick={() => setTab('recipe')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${tab === 'recipe' ? 'bg-white text-primary shadow-sm' : 'text-foreground/40'}`}>Recipe</button>
          )}
          <button onClick={() => setTab('restock')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${tab === 'restock' ? 'bg-white text-primary shadow-sm' : 'text-foreground/40'}`}>Restock</button>
          <button onClick={() => setTab('edit')} className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${tab === 'edit' ? 'bg-white text-primary shadow-sm' : 'text-foreground/40'}`}>Edit Info</button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {tab === 'edit' ? (
            <IngredientForm data={editData} setData={setEditData} categories={categories} getAutoCategory={getAutoCategory} />
          ) : tab === 'recipe' ? (
            <div className="space-y-6">
              <div className="space-y-2">
                {subRecipes.map(r => (
                  <div key={r.id} className="flex justify-between items-center bg-muted/20 p-3 rounded-xl">
                    <p className="text-sm font-bold">{r.ingredients?.name} ({r.quantity_needed}{r.ingredients?.unit})</p>
                    <button onClick={async () => { await supabase.from('recipes').delete().eq('id', r.id); loadRecipeData(); }} className="text-red-400">×</button>
                  </div>
                ))}
              </div>
              <div className="p-4 bg-primary/5 rounded-xl space-y-3 border border-primary/10">
                <select value={recipeForm.ingredient_id} onChange={e => setRecipeForm({...recipeForm, ingredient_id: e.target.value})} className="w-full h-11 px-3 rounded-lg border border-muted text-sm bg-white">
                  <option value="">Add ingredient...</option>
                  {allIngredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <input type="number" placeholder="Qty" value={recipeForm.quantity_needed || ''} onChange={e => setRecipeForm({...recipeForm, quantity_needed: +e.target.value})} className="flex-1 h-11 px-3 rounded-lg border border-muted text-sm" />
                  <button onClick={async () => {
                    const { data: { user } } = await supabase.auth.getUser();
                    await supabase.from('recipes').insert({ baker_id: user?.id, parent_ingredient_id: ingredient.id, ingredient_id: recipeForm.ingredient_id, quantity_needed: recipeForm.quantity_needed });
                    setRecipeForm({ ingredient_id: '', quantity_needed: 0 }); loadRecipeData();
                  }} className="h-11 px-6 bg-primary text-white rounded-lg font-black text-xs uppercase shadow-md shadow-primary/20">ADD</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-black uppercase text-foreground/30">Restock Mode</p>
                <button onClick={() => setIsBulk(!isBulk)} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase shadow-sm ${isBulk ? 'bg-primary text-white' : 'bg-muted text-foreground/40'}`}>
                  {isBulk ? 'Bulk Mode' : 'Single Unit'}
                </button>
              </div>
              {isBulk ? (
                <div className="grid grid-cols-3 gap-3 bg-muted/20 p-5 rounded-2xl border border-muted/50">
                  <input type="number" value={numPacks} onChange={e => setNumPacks(+e.target.value)} placeholder="Packs" className="h-12 px-3 rounded-lg border border-muted text-sm font-black outline-none" />
                  <input type="number" value={packSize} onChange={e => setPackSize(+e.target.value)} placeholder="Size" className="h-12 px-3 rounded-lg border border-muted text-sm font-black outline-none" />
                  <select value={packSizeUnit} onChange={e => setPackSizeUnit(e.target.value)} className="h-12 px-2 rounded-lg border border-muted text-xs font-black bg-white">
                    {['g', 'kg', 'ml', 'L', 'pcs'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <div className="col-span-3 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/30">RM</span>
                    <input type="number" value={pricePerPack} onChange={e => setPricePerPack(+e.target.value)} placeholder="Price Each" className="w-full h-12 pl-12 pr-4 rounded-lg border border-muted text-sm font-black outline-none" />
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  <input type="number" value={qtyInput} onChange={e => setQtyInput(+e.target.value)} placeholder="Qty" className="w-24 h-14 rounded-xl border-muted border-2 text-lg font-black text-center outline-none" />
                  <div className="flex-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/30">RM</span>
                    <input type="number" value={totalPrice} onChange={e => setTotalPrice(+e.target.value)} placeholder="Total Price" className="w-full h-14 pl-12 pr-4 rounded-xl border-muted border-2 text-lg font-black outline-none" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pt-6 flex-none space-y-3">
          {tab === 'edit' ? (
            <>
              <button onClick={() => onUpdate(ingredient, editData).then(onClose)} className="w-full h-16 bg-primary text-white rounded-xl font-black text-lg shadow-xl shadow-primary/20">SAVE CHANGES</button>
              <button onClick={() => onDelete(ingredient.id).then(onClose)} className="w-full h-10 text-red-500 font-bold text-xs hover:bg-red-50 rounded-lg transition-colors">DELETE ITEM</button>
            </>
          ) : tab === 'restock' ? (
            <button onClick={handleRestockSubmit} disabled={loading} className="w-full h-16 bg-primary text-white rounded-xl font-black text-lg shadow-xl shadow-primary/20">
              {loading ? 'RECORDING...' : 'SAVE RESTOCK'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
