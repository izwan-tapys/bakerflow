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
  
  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', unit: '', current_stock: 0, low_stock_threshold: 0 });

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

  const handleUpdateIngredient = async () => {
    if (!editingId) return;
    await supabase.from('ingredients').update({
      name: editForm.name,
      unit: editForm.unit,
      current_stock: editForm.current_stock,
      low_stock_threshold: editForm.low_stock_threshold
    }).eq('id', editingId);
    
    setEditingId(null);
    loadIngredients();
  };

  const startEdit = (ing: Ingredient) => {
    setEditingId(ing.id);
    setEditForm({ 
      name: ing.name, 
      unit: ing.unit, 
      current_stock: ing.current_stock,
      low_stock_threshold: ing.low_stock_threshold 
    });
  };

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
                  {editingId === ingredient.id ? (
                    <input 
                      value={editForm.name} 
                      onChange={e => setEditForm({...editForm, name: e.target.value})}
                      className="h-8 px-2 rounded-lg border border-muted text-sm font-bold focus:border-primary focus:outline-none flex-1 mr-4"
                    />
                  ) : (
                    <p className="font-bold text-foreground">{ingredient.name}</p>
                  )}
                  
                  <div className="flex gap-2">
                    {editingId === ingredient.id ? (
                      <>
                        <button onClick={handleUpdateIngredient} className="text-green-500 font-bold text-xs bg-green-50 px-2 py-1 rounded-lg">Save</button>
                        <button onClick={() => setEditingId(null)} className="text-foreground/40 font-bold text-xs bg-muted px-2 py-1 rounded-lg">Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(ingredient)} className="text-primary/60 hover:text-primary text-xs font-bold">Edit</button>
                    )}
                  </div>
                </div>

                {editingId === ingredient.id ? (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-[10px] text-foreground/40 font-bold uppercase mb-0.5">Unit</p>
                      <select 
                        value={editForm.unit} 
                        onChange={e => setEditForm({...editForm, unit: e.target.value})}
                        className="h-8 w-full rounded border border-muted text-xs bg-white"
                      >
                        {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-foreground/40 font-bold uppercase mb-0.5">Stock</p>
                      <input 
                        type="number" 
                        value={editForm.current_stock} 
                        onChange={e => setEditForm({...editForm, current_stock: +e.target.value})}
                        className="h-8 w-full rounded border border-muted text-xs px-1"
                      />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-foreground/40 font-bold uppercase mb-0.5">Alert At</p>
                      <input 
                        type="number" 
                        value={editForm.low_stock_threshold} 
                        onChange={e => setEditForm({...editForm, low_stock_threshold: +e.target.value})}
                        className="h-8 w-full rounded border border-muted text-xs px-1"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-foreground/40 text-[10px] uppercase font-bold tracking-wide">Unit</p>
                      <p className="font-bold">{ingredient.unit}</p>
                    </div>
                    <div>
                      <p className="text-foreground/40 text-[10px] uppercase font-bold tracking-wide">Stock</p>
                      <p className={`font-bold ${inCart ? 'text-orange-600' : isLow ? 'text-red-600' : 'text-foreground'}`}>{ingredient.current_stock}{ingredient.unit}</p>
                    </div>
                    <div>
                      <p className="text-foreground/40 text-[10px] uppercase font-bold tracking-wide">Alert At</p>
                      <p className="font-bold">{ingredient.low_stock_threshold}{ingredient.unit}</p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-3">
                  <div className="flex-1">
                    <RestockModal ingredient={ingredient} onRestock={handleRestock} />
                  </div>
                  {!editingId && (
                    <button 
                      onClick={() => handleDeleteIngredient(ingredient.id)}
                      className="mt-3 px-3 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors text-xs font-bold"
                    >
                      Delete
                    </button>
                  )}
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
  const [purchaseUnit, setPurchaseUnit] = useState(ingredient.unit);
  const [totalPrice, setTotalPrice] = useState<number | ''>('');
  const [costPerUnit, setCostPerUnit] = useState<number | ''>(ingredient.avg_cost_per_unit);
  const [inputMode, setInputMode] = useState<'total' | 'unit'>('total');

  // Auto-calculate unit cost when total price or qty changes
  useEffect(() => {
    if (inputMode === 'total' && qty && qty > 0 && totalPrice && totalPrice > 0) {
      setCostPerUnit(totalPrice / qty);
    }
  }, [totalPrice, qty, inputMode]);

  // Auto-calculate total price when unit cost or qty changes
  useEffect(() => {
    if (inputMode === 'unit' && qty && qty > 0 && costPerUnit && costPerUnit > 0) {
      setTotalPrice(qty * costPerUnit);
    }
  }, [costPerUnit, qty, inputMode]);

  const handleSubmit = () => {
    if (qty === '' || costPerUnit === '') return;
    
    let finalQty = qty;
    let finalCostPerBaseUnit = costPerUnit;

    // Conversion Logic (Base Unit is g/ml etc)
    if ((purchaseUnit === 'kg' && ingredient.unit === 'g') || (purchaseUnit === 'L' && ingredient.unit === 'ml')) {
      finalQty = qty * 1000;
      finalCostPerBaseUnit = costPerUnit / 1000;
    }

    onRestock(ingredient, finalQty, finalCostPerBaseUnit);
    setOpen(false);
    setQty('');
    setTotalPrice('');
    setCostPerUnit(ingredient.avg_cost_per_unit);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="mt-3 w-full h-9 rounded-xl border border-dashed border-primary/30 text-primary/60 text-xs font-bold hover:border-primary hover:bg-primary/5 hover:text-primary transition-all">
      + Restock
    </button>
  );

  return (
    <div className="mt-3 bg-muted/30 rounded-xl p-3 border border-muted/50 space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs font-bold text-foreground">Restock {ingredient.name}</p>
        <div className="flex bg-white rounded-lg p-0.5 border border-muted">
          <button onClick={() => setInputMode('total')} className={`px-2 py-0.5 text-[9px] font-bold rounded ${inputMode === 'total' ? 'bg-primary text-white' : 'text-foreground/40'}`}>Total RM</button>
          <button onClick={() => setInputMode('unit')} className={`px-2 py-0.5 text-[9px] font-bold rounded ${inputMode === 'unit' ? 'bg-primary text-white' : 'text-foreground/40'}`}>Unit RM</button>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-foreground/40 uppercase">Qty Bought</label>
          <div className="flex gap-1">
            <input type="number" placeholder="0" value={qty} onChange={e => setQty(e.target.value === '' ? '' : +e.target.value)}
              className="flex-1 h-8 px-2 rounded-lg border border-muted text-xs focus:outline-none bg-white font-bold" />
            <select value={purchaseUnit} onChange={e => setPurchaseUnit(e.target.value)}
              className="w-12 h-8 px-1 rounded-lg border border-muted text-[10px] font-bold bg-white">
              {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-foreground/40 uppercase">
            {inputMode === 'total' ? 'Total Paid (RM)' : `Price per ${purchaseUnit}`}
          </label>
          <input 
            type="number" 
            placeholder="0.00"
            value={inputMode === 'total' ? totalPrice : costPerUnit} 
            onChange={e => {
              const val = e.target.value === '' ? '' : +e.target.value;
              if (inputMode === 'total') setTotalPrice(val);
              else setCostPerUnit(val);
            }}
            className="w-full h-8 px-2 rounded-lg border border-muted text-xs focus:outline-none bg-white font-bold" 
          />
        </div>
      </div>

      {/* Summary / Calculation Info */}
      <div className="bg-white/50 p-2 rounded-lg border border-muted/50 space-y-1">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-foreground/40 font-medium italic">Calculated Cost:</span>
          <span className="font-black text-primary">RM {Number(costPerUnit || 0).toFixed(4)} / {purchaseUnit}</span>
        </div>
        {purchaseUnit !== ingredient.unit && (
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-foreground/40 font-medium italic">Base Unit Cost:</span>
            <span className="font-black text-orange-600">RM {Number((purchaseUnit === 'kg' || purchaseUnit === 'L') ? (Number(costPerUnit || 0) / 1000) : (costPerUnit || 0)).toFixed(4)} / {ingredient.unit}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 h-8 rounded-lg border border-muted text-[10px] font-bold">Cancel</button>
        <button onClick={handleSubmit} disabled={!qty || !costPerUnit || Number(qty) <= 0} className="flex-1 h-8 rounded-lg bg-primary text-white text-[10px] font-bold disabled:opacity-50 shadow-md shadow-primary/20">Confirm Restock</button>
      </div>
    </div>
  );
}
