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
  const [form, setForm] = useState({ name: '', unit: 'g', current_stock: 0, avg_cost_per_unit: 0, low_stock_threshold: 100 });

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

    // Calculate required ingredients based on orders
    const requiredMap = new Map<string, number>();
    activeOrders.forEach(order => {
      if (!order.product_id) return;
      const orderRecipes = allRecipes.filter(r => r.product_id === order.product_id);
      orderRecipes.forEach(recipe => {
        const current = requiredMap.get(recipe.ingredient_id) || 0;
        requiredMap.set(recipe.ingredient_id, current + (recipe.quantity_needed * order.quantity));
      });
    });

    // Determine shortfall
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
    await supabase.from('ingredients').insert({ ...form, baker_id: user.id });
    setForm({ name: '', unit: 'g', current_stock: 0, avg_cost_per_unit: 0, low_stock_threshold: 100 });
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

  const handleDeleteIngredient = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ingredient? It will also be removed from any recipes using it.')) return;
    await supabase.from('ingredients').delete().eq('id', id);
    loadIngredients();
  };

  const lowStock = ingredients.filter(i => i.current_stock <= i.low_stock_threshold && !shoppingList.find(s => s.ingredient.id === i.id));

  return (
    <div className="space-y-5 pb-4">
      <KitchenTabs />

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Inventory 📦</h1>
          <p className="text-foreground/50 text-sm">Track ingredients with Moving Average COGS</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="h-10 px-4 bg-primary text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 hover:scale-105 transition-all">
          + Add
        </button>
      </div>

      {/* Shopping List Alert based on Orders */}
      {shoppingList.length > 0 && (
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛒</span>
            <div>
              <p className="font-bold text-orange-800 text-sm">Shopping List</p>
              <p className="text-orange-700/70 text-xs">Based on upcoming orders, you need to buy:</p>
            </div>
          </div>
          <div className="space-y-2">
            {shoppingList.map(item => (
              <div key={item.ingredient.id} className="flex justify-between items-center bg-white/60 p-2 rounded-lg border border-orange-100">
                <span className="font-bold text-sm text-orange-900">{item.ingredient.name}</span>
                <div className="text-right">
                  <p className="text-xs font-black text-orange-600">Buy {item.shortfall.toFixed(1)}{item.ingredient.unit}</p>
                  <p className="text-[10px] text-orange-800/50">Need {item.needed.toFixed(1)}{item.ingredient.unit} (Have {item.ingredient.current_stock.toFixed(1)})</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-1">
          <p className="font-bold text-red-700 text-sm">⚠️ Low Stock Alert</p>
          <p className="text-red-600 text-xs">{lowStock.map(i => i.name).join(', ')} — running low!</p>
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-muted p-4 space-y-3 shadow-sm">
          <p className="font-bold text-sm">Add New Ingredient</p>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name (e.g. Tepung)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="col-span-2 h-10 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
            <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
              className="h-10 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none bg-white">
              {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u}>{u}</option>)}
            </select>
            <input type="number" placeholder="Initial Stock" value={form.current_stock || ''} onChange={e => setForm({ ...form, current_stock: +e.target.value })}
              className="h-10 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
            <input type="number" placeholder="Cost per unit (RM)" step="0.001" value={form.avg_cost_per_unit || ''} onChange={e => setForm({ ...form, avg_cost_per_unit: +e.target.value })}
              className="h-10 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
            <input type="number" placeholder="Low stock alert at" value={form.low_stock_threshold || ''} onChange={e => setForm({ ...form, low_stock_threshold: +e.target.value })}
              className="h-10 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 h-10 rounded-xl border border-muted text-sm font-medium hover:bg-muted/50">Cancel</button>
            <button onClick={handleAddIngredient} className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50" disabled={!form.name}>Add Ingredient</button>
          </div>
        </div>
      )}

      {/* Ingredients List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}</div>
      ) : ingredients.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-2">🥚</div>
          <p className="text-foreground/50 font-medium">No ingredients yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ingredients.map(ingredient => {
            const inCart = shoppingList.find(s => s.ingredient.id === ingredient.id);
            const isLow = ingredient.current_stock <= ingredient.low_stock_threshold;
            
            return (
              <div key={ingredient.id} className={`bg-white rounded-2xl p-4 border-2 transition-all ${inCart ? 'border-orange-300 shadow-sm' : isLow ? 'border-red-200' : 'border-muted/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-foreground">{ingredient.name}</p>
                  {inCart ? (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Buy {inCart.shortfall}{ingredient.unit}</span>
                  ) : isLow && (
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Low!</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-foreground/40 text-[10px] uppercase font-bold tracking-wide">Stock</p>
                    <p className={`font-bold ${inCart ? 'text-orange-600' : isLow ? 'text-red-600' : 'text-foreground'}`}>{ingredient.current_stock}{ingredient.unit}</p>
                  </div>
                  <div>
                    <p className="text-foreground/40 text-[10px] uppercase font-bold tracking-wide">Avg Cost</p>
                    <p className="font-bold">RM{ingredient.avg_cost_per_unit.toFixed(4)}/{ingredient.unit}</p>
                  </div>
                  <div>
                    <p className="text-foreground/40 text-[10px] uppercase font-bold tracking-wide">Alert At</p>
                    <p className="font-bold">{ingredient.low_stock_threshold}{ingredient.unit}</p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <div className="flex-1">
                    <RestockModal ingredient={ingredient} onRestock={handleRestock} />
                  </div>
                  <button 
                    onClick={() => handleDeleteIngredient(ingredient.id)}
                    className="mt-3 px-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors text-xs font-bold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RestockModal({ ingredient, onRestock }: { ingredient: Ingredient; onRestock: (i: Ingredient, qty: number, cost: number) => void }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState<number | ''>('');
  const [cost, setCost] = useState<number | ''>(ingredient.avg_cost_per_unit);

  if (!open) return (
    <button onClick={() => setOpen(true)} className="mt-3 w-full h-9 rounded-xl border border-dashed border-primary/30 text-primary/60 text-xs font-bold hover:border-primary hover:bg-primary/5 hover:text-primary transition-all">
      + Restock
    </button>
  );

  return (
    <div className="mt-3 bg-muted/30 rounded-xl p-3 border border-muted/50 space-y-3">
      <p className="text-xs font-bold text-foreground">Restock {ingredient.name}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] uppercase font-bold tracking-wide text-foreground/50">Quantity ({ingredient.unit})</label>
          <input type="number" placeholder="0" value={qty} onChange={e => setQty(+e.target.value)} className="w-full h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none mt-1" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-bold tracking-wide text-foreground/50">Cost per {ingredient.unit} (RM)</label>
          <input type="number" placeholder="0.00" step="0.001" value={cost} onChange={e => setCost(+e.target.value)} className="w-full h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none mt-1" />
        </div>
      </div>
      <p className="text-xs text-foreground/60">
        New Avg Cost: <strong className="text-primary">RM{Number(qty) > 0 ? (((ingredient.current_stock * ingredient.avg_cost_per_unit) + (Number(qty) * Number(cost))) / (ingredient.current_stock + Number(qty))).toFixed(4) : ingredient.avg_cost_per_unit.toFixed(4)}</strong>/{ingredient.unit}
      </p>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 h-8 rounded-lg border border-muted text-xs font-medium hover:bg-muted/50">Cancel</button>
        <button onClick={() => { onRestock(ingredient, Number(qty), Number(cost)); setOpen(false); setQty(''); }} disabled={!qty || Number(qty) <= 0} className="flex-1 h-8 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50">Confirm</button>
      </div>
    </div>
  );
}
