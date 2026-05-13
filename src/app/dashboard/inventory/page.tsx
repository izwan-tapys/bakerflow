'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { KitchenTabs } from '@/components/dashboard/KitchenTabs';

interface Ingredient {
  id: string;
  name: string;
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

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', unit: 'g', current_stock: 0, category: 'Lain-lain' });
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const CATEGORIES = ['Semua', 'Tepung', 'Tenusu', 'Gula', 'Lemak', 'Hiasan', 'Packaging', 'Lain-lain'];
  
  // Modal State
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);

  const loadIngredients = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const [ingRes, ordersRes, recipesRes] = await Promise.all([
      supabase.from('ingredients').select('*').eq('baker_id', user.id).order('name'),
      supabase.from('orders').select('product_id, quantity').eq('baker_id', user.id).in('status', ['pending', 'approved', 'production']),
      supabase.from('recipes').select('*').eq('baker_id', user.id)
    ]);

    const loadedIngredients = ingRes.data || [];
    const activeOrders = ordersRes.data || [];
    const allRecipes = recipesRes.data || [];

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
    setLoading(false);
  }, []);

  useEffect(() => { loadIngredients(); }, [loadIngredients]);

  const handleAddIngredient = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('ingredients').insert({ 
      baker_id: user.id,
      name: form.name,
      unit: form.unit,
      current_stock: form.current_stock,
      category: form.category,
      avg_cost_per_unit: 0,
      low_stock_threshold: 0
    });
    setForm({ name: '', unit: 'g', current_stock: 0, category: 'Lain-lain' });
    setShowAdd(false);
    loadIngredients();
  };

  const handleRestock = async (ingredient: Ingredient, qty: number, cost: number) => {
    const totalExistingValue = ingredient.current_stock * ingredient.avg_cost_per_unit;
    const newPurchaseValue = qty * cost;
    const newTotalStock = ingredient.current_stock + qty;
    const newAvgCost = newTotalStock > 0 ? (totalExistingValue + newPurchaseValue) / newTotalStock : cost;

    const { data: { user } } = await supabase.auth.getUser();

    await supabase.from('ingredients').update({
      current_stock: newTotalStock,
      avg_cost_per_unit: Math.round(newAvgCost * 10000) / 10000,
    }).eq('id', ingredient.id);

    await supabase.from('ingredient_purchases').insert({
      ingredient_id: ingredient.id,
      baker_id: user?.id,
      quantity: qty,
      unit_cost: cost,
      total_cost: qty * cost,
    });

    loadIngredients();
  };

  const handleUpdateInfo = async (ingredient: Ingredient, updatedData: any) => {
    const { error } = await supabase.from('ingredients').update(updatedData).eq('id', ingredient.id);
    if (error) throw error;
    await loadIngredients();
  };

  const handleDeleteIngredient = async (id: string) => {
    if (!confirm('Are you sure? This will remove the ingredient from all recipes.')) return;
    await supabase.from('ingredients').delete().eq('id', id);
    loadIngredients();
  };

  const filteredIngredients = ingredients.filter(i => {
    if (selectedCategory === 'Semua') return true;
    return i.category === selectedCategory;
  });

  const lowStock = ingredients.filter(i => i.current_stock <= i.low_stock_threshold && !shoppingList.find(s => s.ingredient.id === i.id));

  const handleShareWhatsApp = () => {
    if (shoppingList.length === 0) return;
    let message = `🛒 *SHOPPING LIST BAKERFLOW*\n\n`;
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
    <div className="space-y-5 pb-4">
      <KitchenTabs />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Inventory 📦</h1>
          <p className="text-foreground/50 text-sm">Efficient ingredient management</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="h-10 px-4 bg-primary text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20">
          + Add
        </button>
      </div>

      {/* Shopping List & Alerts (Keep these as they are helpful) */}
      {shoppingList.length > 0 && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="font-bold text-orange-800 text-sm flex items-center gap-2">🛒 Shopping List <span className="bg-orange-200 text-orange-800 px-2 py-0.5 rounded text-[10px]">{shoppingList.length}</span></p>
            <button 
              onClick={handleShareWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1 bg-green-500 text-white rounded-lg text-[10px] font-bold hover:bg-green-600 transition-all"
            >
              Share WhatsApp
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {shoppingList.map(item => {
              let packs = null;
              if (item.ingredient.pack_size) {
                let sizeInBase = item.ingredient.pack_size;
                // Convert pack size to base unit for division
                if ((item.ingredient.pack_size_unit === 'kg' && item.ingredient.unit === 'g') || 
                    (item.ingredient.pack_size_unit === 'L' && item.ingredient.unit === 'ml')) {
                  sizeInBase = item.ingredient.pack_size * 1000;
                }
                packs = Math.ceil(item.shortfall / sizeInBase);
              }
              return (
                <div key={item.ingredient.id} onClick={() => setSelectedIngredient(item.ingredient)} className="flex-none bg-white p-2 px-3 rounded-xl border border-orange-200 cursor-pointer hover:border-orange-400 transition-all">
                  <p className="font-black text-xs text-orange-900">{item.ingredient.name}</p>
                  {packs ? (
                    <p className="text-[10px] font-bold text-orange-600">
                      {packs} {item.ingredient.pack_unit || 'pek'} ({item.shortfall.toFixed(0)}{item.ingredient.unit})
                    </p>
                  ) : (
                    <p className="text-[10px] font-bold text-orange-600">Buy {item.shortfall.toFixed(0)}{item.ingredient.unit}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white rounded-3xl border-2 border-primary/20 p-5 space-y-4 shadow-xl">
          <p className="font-black text-lg text-primary">New Ingredient</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-black uppercase text-foreground/40 mb-1 block">Name</label>
              <input placeholder="e.g. Premium Flour" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-muted focus:border-primary outline-none font-bold" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-foreground/40 mb-1 block">Unit</label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-muted focus:border-primary outline-none bg-white font-bold">
                {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-foreground/40 mb-1 block">Initial Stock</label>
              <input type="number" value={form.current_stock || ''} onChange={e => setForm({ ...form, current_stock: +e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-muted focus:border-primary outline-none font-bold" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black uppercase text-foreground/40 mb-1 block">Category</label>
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="w-full h-11 px-4 rounded-xl border border-muted focus:border-primary outline-none bg-white font-bold">
                {CATEGORIES.filter(c => c !== 'Semua').map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 h-12 rounded-xl border border-muted font-bold text-foreground/50">Cancel</button>
            <button onClick={handleAddIngredient} className="flex-[2] h-12 bg-primary text-white rounded-xl font-black shadow-lg shadow-primary/20">Create Ingredient</button>
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setSelectedCategory(c)}
            className={`px-4 py-2 rounded-full text-xs font-black transition-all whitespace-nowrap border-2 ${
              selectedCategory === c 
                ? 'bg-primary border-primary text-white shadow-lg' 
                : 'bg-white border-muted text-foreground/40 hover:border-primary/30'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Ingredients List Table */}
      <div className="bg-white rounded-[32px] border border-muted overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30">
                <th className="px-5 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest">Ingredient</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right">Stock</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right">Cost/Unit</th>
                <th className="px-5 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/50">
              {loading ? (
                [1,2,3,4,5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-5 py-4"><div className="h-4 bg-muted rounded w-32" /></td>
                    <td className="px-5 py-4 text-right"><div className="h-4 bg-muted rounded w-16 ml-auto" /></td>
                    <td className="px-5 py-4 text-right"><div className="h-4 bg-muted rounded w-20 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredIngredients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-20 text-center text-foreground/30 font-bold italic">No ingredients found in this category.</td>
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
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-foreground">{ing.name}</p>
                          {isLow && !isNegative && <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" title="Low Stock" />}
                          {isNegative && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Insufficient Stock" />}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-col items-end">
                          <p className={`font-black ${isNegative ? 'text-red-600' : isLow ? 'text-orange-500' : 'text-foreground/70'}`}>
                            {available.toLocaleString()}<span className="text-[10px] font-bold ml-0.5 opacity-40">{ing.unit}</span>
                          </p>
                          {committed > 0 && (
                            <p className="text-[9px] font-bold text-foreground/30 uppercase tracking-tighter">
                              On Hand: {ing.current_stock}{ing.unit}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-primary/80">
                        RM {ing.avg_cost_per_unit.toFixed(4)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteIngredient(ing.id); }}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-red-300 hover:text-red-600 hover:bg-red-50 transition-all"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unified Action Modal */}
      {selectedIngredient && (
        <IngredientActionModal 
          ingredient={selectedIngredient}
          onClose={() => { setSelectedIngredient(null); }}
          onRestock={handleRestock}
          onUpdate={handleUpdateInfo}
          onDelete={handleDeleteIngredient}
        />
      )}
    </div>
  );
}

function IngredientActionModal({ ingredient, onClose, onRestock, onUpdate, onDelete }: { 
  ingredient: Ingredient, 
  onClose: () => void,
  onRestock: (i: Ingredient, q: number, c: number) => Promise<void>,
  onUpdate: (i: Ingredient, d: any) => Promise<void>,
  onDelete: (id: string) => Promise<void>
}) {
  const [tab, setTab] = useState<'restock' | 'edit'>('restock');
  const [loading, setLoading] = useState(false);

  // Restock State - Single Unit
  const [qtyInput, setQtyInput] = useState<number | ''>('');
  const [purchaseUnit, setPurchaseUnit] = useState(ingredient.unit);
  const [totalPrice, setTotalPrice] = useState<number | ''>('');

  // Restock State - Bulk/Pack Mode
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
    pack_size: ingredient.pack_size ?? '' as number | '',
    pack_unit: ingredient.pack_unit ?? '',
    pack_size_unit: ingredient.pack_size_unit ?? ingredient.unit,
  });

  // Dynamic Calculations for UI Display
  const isKgToG = (isBulk ? packSizeUnit : purchaseUnit) === 'kg' && ingredient.unit === 'g';
  const isGToKg = (isBulk ? packSizeUnit : purchaseUnit) === 'g' && ingredient.unit === 'kg';
  const isLToMl = (isBulk ? packSizeUnit : purchaseUnit) === 'L' && ingredient.unit === 'ml';
  const isMlToL = (isBulk ? packSizeUnit : purchaseUnit) === 'ml' && ingredient.unit === 'L';

  let displayQty = 0;
  if (isBulk) {
    let sizeInBase = Number(packSize);
    if (isKgToG || isLToMl) sizeInBase = Number(packSize) * 1000;
    if (isGToKg || isMlToL) sizeInBase = Number(packSize) / 1000;
    displayQty = Number(numPacks) * sizeInBase;
  } else {
    if (isKgToG || isLToMl) displayQty = Number(qtyInput) * 1000;
    else if (isGToKg || isMlToL) displayQty = Number(qtyInput) / 1000;
    else displayQty = Number(qtyInput);
  }

  const displayTotal = isBulk ? (Number(numPacks) * Number(pricePerPack)) : Number(totalPrice);

  const handleRestockSubmit = async () => {
    if (!displayQty || !displayTotal) return;
    
    setLoading(true);
    const finalQty = displayQty;
    const finalTotalVal = displayTotal;
    const finalCostPerBaseUnit = finalTotalVal / finalQty;
    
    await onRestock(ingredient, finalQty, finalCostPerBaseUnit);
    onClose();
  };

  const handleEditSubmit = async () => {
    if (!editForm.name) return alert("Nama bahan wajib isi!");
    
    setLoading(true);
    try {
      const cleanData = {
        name: editForm.name,
        unit: editForm.unit,
        current_stock: Number(editForm.current_stock) || 0,
        low_stock_threshold: Number(editForm.low_stock_threshold) || 0,
        category: editForm.category,
        pack_size: editForm.pack_size === '' ? null : Number(editForm.pack_size),
        pack_unit: editForm.pack_unit || null,
        pack_size_unit: editForm.pack_size_unit || null
      };
      
      await onUpdate(ingredient, cleanData);
      onClose();
    } catch (err: any) {
      console.error("Failed to update ingredient:", err);
      alert("Gagal update: " + (err.message || "Sila semak console"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[40px] p-6 shadow-2xl space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-black text-foreground">{ingredient.name}</h2>
            <div className="flex items-center gap-2">
              <p className={`text-xs font-bold ${ingredient.current_stock < 0 ? 'text-red-600' : 'text-foreground/40'}`}>
                Current: {ingredient.current_stock}{ingredient.unit}
              </p>
              {ingredient.current_stock < 0 && (
                <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">
                  ⚠️ SHORT: {Math.abs(ingredient.current_stock)}{ingredient.unit}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-muted rounded-full text-foreground/40 text-2xl font-bold">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex bg-muted/50 p-1.5 rounded-2xl">
          <button onClick={() => setTab('restock')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${tab === 'restock' ? 'bg-white text-primary shadow-sm' : 'text-foreground/40'}`}>🚚 Restock</button>
          <button onClick={() => setTab('edit')} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase transition-all ${tab === 'edit' ? 'bg-white text-primary shadow-sm' : 'text-foreground/40'}`}>⚙️ Edit Info</button>
        </div>

        {tab === 'restock' ? (
          <div className="space-y-5">
            <div className="flex justify-between items-center px-1">
              <p className="text-[10px] font-black uppercase text-foreground/30 tracking-widest">Restock Mode</p>
              <button 
                onClick={() => setIsBulk(!isBulk)}
                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${isBulk ? 'bg-primary text-white shadow-md' : 'bg-muted text-foreground/40'}`}
              >
                {isBulk ? '📦 Bulk / Packs' : '⚖️ Single Unit'}
              </button>
            </div>
            
            <div className="bg-muted/30 p-3 rounded-2xl border border-muted/50">
              <label className="text-[10px] font-black uppercase text-foreground/40 mb-1 block">Category</label>
              <select value={editForm.category} onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                className="w-full h-10 px-3 rounded-xl border border-muted focus:border-primary outline-none bg-white font-bold text-xs">
                {['Tepung', 'Tenusu', 'Gula', 'Lemak', 'Hiasan', 'Packaging', 'Lain-lain'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {isBulk ? (
              <>
                <div className="grid grid-cols-3 gap-2 bg-muted/20 p-4 rounded-3xl border border-muted/50">
                  <div>
                    <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">How many?</label>
                    <input type="number" placeholder="e.g. 10" value={numPacks} onChange={e => setNumPacks(e.target.value === '' ? '' : +e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-muted text-sm font-black focus:border-primary outline-none" />
                    <p className="text-[9px] font-bold text-foreground/30 mt-1 text-center">Packs/Bottles</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Size each</label>
                    <input type="number" placeholder="e.g. 1" value={packSize} onChange={e => setPackSize(e.target.value === '' ? '' : +e.target.value)}
                      className="w-full h-11 px-3 rounded-xl border border-muted text-sm font-black focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Unit</label>
                    <select value={packSizeUnit} onChange={e => setPackSizeUnit(e.target.value)}
                      className="w-full h-11 px-2 rounded-xl border border-muted text-xs font-black bg-white focus:border-primary">
                      {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Price each (RM)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/30">RM</span>
                      <input type="number" placeholder="e.g. 2.50" value={pricePerPack} onChange={e => setPricePerPack(e.target.value === '' ? '' : +e.target.value)}
                        className="w-full h-11 pl-10 pr-2 rounded-xl border border-muted text-sm font-black focus:border-primary outline-none" />
                    </div>
                  </div>
                </div>
                {numPacks && packSize && pricePerPack && (
                  <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 flex justify-between items-center text-sm">
                    <span className="font-bold text-green-700">📦 {numPacks} pek × {packSize}{packSizeUnit} =</span>
                    <span className="font-black text-green-800">{displayQty}{ingredient.unit} · RM {displayTotal.toFixed(2)}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-24">
                  <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Qty</label>
                  <input type="number" placeholder="0" value={qtyInput} onChange={e => setQtyInput(e.target.value === '' ? '' : +e.target.value)}
                    className="w-full h-12 px-3 rounded-2xl border border-muted text-sm font-black focus:outline-none focus:border-primary text-center" />
                </div>
                <div className="w-20">
                  <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Unit</label>
                  <select value={purchaseUnit} onChange={e => setPurchaseUnit(e.target.value)}
                    className="w-full h-12 px-2 rounded-2xl border border-muted text-[10px] font-black bg-white focus:border-primary">
                    {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Jumlah Bayar (Total RM)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-foreground/30">RM</span>
                    <input type="number" placeholder="0.00" value={totalPrice} onChange={e => setTotalPrice(e.target.value === '' ? '' : +e.target.value)}
                      className="w-full h-12 pl-10 pr-3 rounded-2xl border border-muted text-sm font-black focus:outline-none focus:border-primary" />
                  </div>
                </div>
              </div>
            )}

            <div className="bg-primary/5 p-4 rounded-3xl border border-primary/10 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-foreground/40 font-bold uppercase tracking-tighter">Summary:</span>
                <span className="font-black text-primary">
                  {displayQty > 0 ? `${displayQty}${ingredient.unit} @ RM ${displayTotal.toFixed(2)}` : '-'}
                </span>
              </div>
            </div>

            <button onClick={handleRestockSubmit} disabled={loading || !displayQty || !displayTotal} className="w-full h-14 bg-primary text-white rounded-2xl font-black text-lg shadow-xl shadow-primary/20 disabled:opacity-50">
              {loading ? 'Processing...' : 'Confirm Restock'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Ingredient Name</label>
              <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})}
                className="w-full h-12 px-4 rounded-2xl border border-muted font-bold focus:border-primary outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Base Unit</label>
                <select value={editForm.unit} onChange={e => setEditForm({...editForm, unit: e.target.value})}
                  className="w-full h-12 px-4 rounded-2xl border border-muted font-bold bg-white focus:border-primary">
                  {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Stock Level</label>
                <input type="number" value={editForm.current_stock} onChange={e => setEditForm({...editForm, current_stock: +e.target.value})}
                  className="w-full h-12 px-4 rounded-2xl border border-muted font-bold focus:border-primary outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Low Stock Alert Threshold</label>
              <input type="number" value={editForm.low_stock_threshold} onChange={e => setEditForm({...editForm, low_stock_threshold: +e.target.value})}
                className="w-full h-12 px-4 rounded-2xl border border-muted font-bold focus:border-primary outline-none" />
            </div>

            {/* Pack Setting */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-3">
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">📦 Pack Setting (Optional)</p>
              <p className="text-[9px] text-blue-400">Tetapkan saiz pek supaya Shopping List tunjuk bilangan pek yang perlu dibeli.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Saiz 1 Pek</label>
                    <input type="number" placeholder={`e.g. 1`} value={editForm.pack_size} onChange={e => setEditForm({...editForm, pack_size: e.target.value === '' ? '' : +e.target.value})}
                      className="w-full h-11 px-3 rounded-xl border border-muted font-bold focus:border-primary outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Unit Saiz</label>
                    <select value={editForm.pack_size_unit} onChange={e => setEditForm({...editForm, pack_size_unit: e.target.value})}
                      className="w-full h-11 px-3 rounded-xl border border-muted font-bold bg-white focus:border-primary outline-none text-xs">
                      {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-foreground/40 uppercase mb-1 block">Nama Unit Pek (cth: botol, pek, tin)</label>
                  <input placeholder="e.g. botol" value={editForm.pack_unit} onChange={e => setEditForm({...editForm, pack_unit: e.target.value})}
                    className="w-full h-11 px-3 rounded-xl border border-muted font-bold focus:border-primary outline-none" />
                </div>
              </div>
              {editForm.pack_size && editForm.pack_unit && (
                <p className="text-[10px] font-bold text-blue-600">✓ 1 {editForm.pack_unit} = {editForm.pack_size}{editForm.pack_size_unit}</p>
              )}
            </div>
            
            <div className="space-y-2 pt-4">
              <button onClick={handleEditSubmit} disabled={loading} className="w-full h-12 bg-foreground text-white rounded-2xl font-black shadow-lg">
                {loading ? 'Saving...' : 'Update Details'}
              </button>
              <button 
                onClick={() => { if(confirm('Hapus bahan ini?')) { onDelete(ingredient.id); onClose(); } }} 
                className="w-full h-10 flex items-center justify-center rounded-2xl text-red-500 font-bold hover:bg-red-50 transition-colors text-xs"
              >
                🗑️ Hapus Bahan Dari Inventory
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
