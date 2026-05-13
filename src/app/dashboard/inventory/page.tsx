'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  avg_cost_per_unit: number;
  low_stock_threshold: number;
}

export default function InventoryPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', unit: 'g', current_stock: 0, avg_cost_per_unit: 0, low_stock_threshold: 100 });

  const loadIngredients = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('ingredients').select('*').eq('baker_id', user.id).order('name');
    setIngredients(data || []);
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

  const lowStock = ingredients.filter(i => i.current_stock <= i.low_stock_threshold);

  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">Inventory 📦</h1>
          <p className="text-foreground/50 text-sm">Track ingredients with Moving Average COGS</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="h-10 px-4 bg-primary text-white rounded-xl font-bold text-sm shadow-md shadow-primary/20 hover:scale-105 transition-all">
          + Add
        </button>
      </div>

      {/* Low Stock Alert */}
      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 space-y-1">
          <p className="font-bold text-red-700 text-sm">⚠️ Low Stock Alert</p>
          <p className="text-red-600 text-xs">{lowStock.map(i => i.name).join(', ')} — running low!</p>
        </div>
      )}

      {/* Add Form */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-muted p-4 space-y-3">
          <p className="font-bold text-sm">Add New Ingredient</p>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Name (e.g. Tepung)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="col-span-2 h-10 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
            <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
              className="h-10 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none bg-white">
              {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u}>{u}</option>)}
            </select>
            <input type="number" placeholder="Initial Stock" value={form.current_stock} onChange={e => setForm({ ...form, current_stock: +e.target.value })}
              className="h-10 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
            <input type="number" placeholder="Cost per unit (RM)" step="0.001" value={form.avg_cost_per_unit} onChange={e => setForm({ ...form, avg_cost_per_unit: +e.target.value })}
              className="h-10 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
            <input type="number" placeholder="Low stock alert at" value={form.low_stock_threshold} onChange={e => setForm({ ...form, low_stock_threshold: +e.target.value })}
              className="h-10 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 h-10 rounded-xl border border-muted text-sm font-medium">Cancel</button>
            <button onClick={handleAddIngredient} className="flex-1 h-10 rounded-xl bg-primary text-white text-sm font-bold">Add Ingredient</button>
          </div>
        </div>
      )}

      {/* Ingredients List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />)}</div>
      ) : ingredients.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-2">🥚</div>
          <p className="text-foreground/50">No ingredients yet. Add your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {ingredients.map(ingredient => {
            const isLow = ingredient.current_stock <= ingredient.low_stock_threshold;
            return (
              <div key={ingredient.id} className={`bg-white rounded-2xl p-4 border-2 ${isLow ? 'border-red-200' : 'border-muted/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-foreground">{ingredient.name}</p>
                  {isLow && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Low!</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-foreground/40 text-xs">Stock</p>
                    <p className={`font-bold ${isLow ? 'text-red-600' : 'text-foreground'}`}>{ingredient.current_stock}{ingredient.unit}</p>
                  </div>
                  <div>
                    <p className="text-foreground/40 text-xs">Avg Cost</p>
                    <p className="font-bold">RM{ingredient.avg_cost_per_unit.toFixed(4)}/{ingredient.unit}</p>
                  </div>
                  <div>
                    <p className="text-foreground/40 text-xs">Alert At</p>
                    <p className="font-bold">{ingredient.low_stock_threshold}{ingredient.unit}</p>
                  </div>
                </div>
                <RestockModal ingredient={ingredient} onRestock={handleRestock} />
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
  const [qty, setQty] = useState(0);
  const [cost, setCost] = useState(ingredient.avg_cost_per_unit);

  if (!open) return (
    <button onClick={() => setOpen(true)} className="mt-3 w-full h-9 rounded-xl border border-dashed border-primary/30 text-primary/60 text-xs font-medium hover:border-primary hover:text-primary transition-colors">
      + Restock
    </button>
  );

  return (
    <div className="mt-3 bg-muted/40 rounded-xl p-3 space-y-3">
      <p className="text-xs font-bold text-foreground">Restock {ingredient.name}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-foreground/50">Quantity ({ingredient.unit})</label>
          <input type="number" value={qty} onChange={e => setQty(+e.target.value)} className="w-full h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none mt-1" />
        </div>
        <div>
          <label className="text-xs text-foreground/50">Cost per {ingredient.unit} (RM)</label>
          <input type="number" step="0.001" value={cost} onChange={e => setCost(+e.target.value)} className="w-full h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none mt-1" />
        </div>
      </div>
      <p className="text-xs text-foreground/50">
        New Avg Cost: <strong>RM{qty > 0 ? (((ingredient.current_stock * ingredient.avg_cost_per_unit) + (qty * cost)) / (ingredient.current_stock + qty)).toFixed(4) : ingredient.avg_cost_per_unit.toFixed(4)}</strong>/{ingredient.unit}
      </p>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 h-8 rounded-lg border border-muted text-xs">Cancel</button>
        <button onClick={() => { onRestock(ingredient, qty, cost); setOpen(false); }} className="flex-1 h-8 rounded-lg bg-primary text-white text-xs font-bold">Confirm</button>
      </div>
    </div>
  );
}
