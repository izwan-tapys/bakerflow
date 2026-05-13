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

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

interface Recipe {
  id: string;
  ingredient_id: string;
  quantity_needed: number;
  ingredient?: Ingredient;
}

interface PendingRecipe {
  ingredient_id?: string;
  new_name?: string;
  unit?: string;
  quantity_needed: number;
  display_name: string;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add Product State
  const [showAdd, setShowAdd] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: 0 });
  const [pendingRecipes, setPendingRecipes] = useState<PendingRecipe[]>([]);
  
  // Inline Add Ingredient State
  const [isNewIngredient, setIsNewIngredient] = useState(false);
  const [ingForm, setIngForm] = useState({ ingredient_id: '', new_name: '', unit: 'g', quantity_needed: 0 });

  // Recipe Modal State
  const [editingRecipe, setEditingRecipe] = useState<Product | null>(null);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const [prodRes, ingRes] = await Promise.all([
      supabase.from('products').select('*').eq('baker_id', user.id).order('created_at', { ascending: false }),
      supabase.from('ingredients').select('id, name, unit').eq('baker_id', user.id).order('name')
    ]);

    setProducts(prodRes.data || []);
    setIngredients(ingRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddPendingRecipe = () => {
    if (ingForm.quantity_needed <= 0) return;
    
    if (isNewIngredient) {
      if (!ingForm.new_name) return;
      setPendingRecipes(prev => [...prev, {
        new_name: ingForm.new_name,
        unit: ingForm.unit,
        quantity_needed: ingForm.quantity_needed,
        display_name: ingForm.new_name
      }]);
    } else {
      if (!ingForm.ingredient_id) return;
      const selected = ingredients.find(i => i.id === ingForm.ingredient_id);
      if (!selected) return;
      setPendingRecipes(prev => [...prev, {
        ingredient_id: selected.id,
        unit: selected.unit,
        quantity_needed: ingForm.quantity_needed,
        display_name: selected.name
      }]);
    }
    
    // Reset ingredient form
    setIngForm({ ingredient_id: '', new_name: '', unit: 'g', quantity_needed: 0 });
  };

  const removePendingRecipe = (index: number) => {
    setPendingRecipes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveProduct = async () => {
    if (!form.name || form.price <= 0) return;
    setSavingProduct(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSavingProduct(false);
      return;
    }

    // 1. Insert Product
    const { data: prodData, error: prodError } = await supabase.from('products').insert({
      baker_id: user.id,
      name: form.name,
      description: form.description,
      price: form.price,
      is_active: true
    }).select().single();

    if (prodError || !prodData) {
      setSavingProduct(false);
      return;
    }

    // 2. Insert Recipes & New Ingredients
    for (const recipe of pendingRecipes) {
      let finalIngredientId = recipe.ingredient_id;
      
      // If it's a new ingredient, create it in inventory first
      if (recipe.new_name) {
        const { data: newIng } = await supabase.from('ingredients').insert({
          baker_id: user.id,
          name: recipe.new_name,
          unit: recipe.unit,
          current_stock: 0,
          avg_cost_per_unit: 0,
          low_stock_threshold: 0
        }).select().single();
        
        if (newIng) finalIngredientId = newIng.id;
      }

      // Link to product
      if (finalIngredientId) {
        await supabase.from('recipes').insert({
          baker_id: user.id,
          product_id: prodData.id,
          ingredient_id: finalIngredientId,
          quantity_needed: recipe.quantity_needed
        });
      }
    }

    setForm({ name: '', description: '', price: 0 });
    setPendingRecipes([]);
    setShowAdd(false);
    setSavingProduct(false);
    loadData();
  };

  const toggleActive = async (product: Product) => {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id);
    loadData();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    loadData();
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

      {/* Add Form with Inline Recipe */}
      {showAdd && (
        <div className="bg-white rounded-2xl border border-muted p-5 space-y-5 shadow-sm">
          <div>
            <p className="font-bold text-sm text-foreground">Add New Product</p>
            <p className="text-xs text-foreground/50">Fill in product details and add its recipe.</p>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-foreground/70 block mb-1">Product Name</label>
              <input placeholder="e.g. Chocolate Moist Cake" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-semibold text-foreground/70 block mb-1">Description</label>
                <textarea placeholder="e.g. Rich chocolate cake with premium ganache..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full py-2 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none resize-none" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold text-foreground/70 block mb-1">Price (RM)</label>
                <input type="number" placeholder="0.00" value={form.price || ''} onChange={e => setForm({ ...form, price: +e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none" />
              </div>
            </div>
          </div>

          <div className="border-t border-muted pt-4 space-y-3">
            <p className="text-xs font-bold uppercase text-foreground/50 tracking-wide">Recipe Ingredients (Optional)</p>
            
            {/* Pending Recipes List */}
            {pendingRecipes.length > 0 && (
              <div className="space-y-2">
                {pendingRecipes.map((r, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-muted/30 px-3 py-2 rounded-lg border border-muted/50">
                    <div>
                      <p className="font-bold text-sm text-foreground flex items-center gap-2">
                        {r.display_name} 
                        {r.new_name && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase">New</span>}
                      </p>
                      <p className="text-xs text-foreground/50">{r.quantity_needed}{r.unit}</p>
                    </div>
                    <button onClick={() => removePendingRecipe(idx)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Recipe Form */}
            <div className="bg-muted/30 p-3 rounded-xl border border-muted/50 space-y-3">
              <div className="flex gap-2 bg-white p-1 rounded-lg border border-muted">
                <button onClick={() => setIsNewIngredient(false)} className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${!isNewIngredient ? 'bg-primary text-white shadow-sm' : 'text-foreground/50'}`}>Select Existing</button>
                <button onClick={() => setIsNewIngredient(true)} className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${isNewIngredient ? 'bg-primary text-white shadow-sm' : 'text-foreground/50'}`}>Create New</button>
              </div>

              {isNewIngredient ? (
                <div className="flex gap-2">
                  <input placeholder="New Ingredient Name" value={ingForm.new_name} onChange={e => setIngForm({ ...ingForm, new_name: e.target.value })}
                    className="flex-[2] h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none" />
                  <select value={ingForm.unit} onChange={e => setIngForm({ ...ingForm, unit: e.target.value })}
                    className="flex-1 h-9 px-1 rounded-lg border border-muted text-xs focus:border-primary focus:outline-none bg-white">
                    {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              ) : (
                <select value={ingForm.ingredient_id} onChange={e => setIngForm({ ...ingForm, ingredient_id: e.target.value, unit: ingredients.find(i=>i.id===e.target.value)?.unit || 'g' })}
                  className="w-full h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none bg-white">
                  <option value="">Select ingredient...</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
              )}

              <div className="flex gap-2">
                <input type="number" placeholder="Qty needed" value={ingForm.quantity_needed || ''} onChange={e => setIngForm({ ...ingForm, quantity_needed: +e.target.value })}
                  className="flex-1 h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none" />
                <div className="h-9 px-3 bg-white border border-muted rounded-lg flex items-center justify-center text-sm font-medium text-foreground/50">
                  {isNewIngredient ? ingForm.unit : ingredients.find(i => i.id === ingForm.ingredient_id)?.unit || '-'}
                </div>
                <button onClick={handleAddPendingRecipe} disabled={(isNewIngredient ? !ingForm.new_name : !ingForm.ingredient_id) || ingForm.quantity_needed <= 0} className="h-9 px-4 bg-foreground text-white font-bold text-xs rounded-lg disabled:opacity-50">
                  + Add
                </button>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <button onClick={() => { setShowAdd(false); setPendingRecipes([]); setIngForm({ ingredient_id: '', new_name: '', unit: 'g', quantity_needed: 0 }); }} className="flex-1 h-12 rounded-xl border border-muted text-sm font-medium hover:bg-muted/50">Cancel</button>
            <button onClick={handleSaveProduct} disabled={!form.name || form.price <= 0 || savingProduct} className="flex-[2] h-12 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50 shadow-lg shadow-primary/20">
              {savingProduct ? 'Saving...' : 'Save Product & Recipe'}
            </button>
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
                    onClick={() => setEditingRecipe(product)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 w-24"
                  >
                    📝 Recipe
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

      {/* Recipe Modal */}
      {editingRecipe && (
        <RecipeModal 
          product={editingRecipe} 
          ingredients={ingredients} 
          onClose={() => { setEditingRecipe(null); loadData(); }} 
        />
      )}
    </div>
  );
}

function RecipeModal({ product, ingredients, onClose }: { product: Product, ingredients: Ingredient[], onClose: () => void }) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal Inline Add State
  const [isNewIngredient, setIsNewIngredient] = useState(false);
  const [form, setForm] = useState({ ingredient_id: '', new_name: '', unit: 'g', quantity_needed: 0 });

  const loadRecipes = useCallback(async () => {
    const { data } = await supabase
      .from('recipes')
      .select('*, ingredient:ingredients(name, unit)')
      .eq('product_id', product.id);
    
    setRecipes(data || []);
    setLoading(false);
  }, [product.id]);

  useEffect(() => { loadRecipes(); }, [loadRecipes]);

  const handleAdd = async () => {
    if (form.quantity_needed <= 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    let finalIngredientId = form.ingredient_id;
    
    if (isNewIngredient) {
      if (!form.new_name) return;
      const { data: newIng } = await supabase.from('ingredients').insert({
        baker_id: user.id,
        name: form.new_name,
        unit: form.unit,
        current_stock: 0,
        avg_cost_per_unit: 0,
        low_stock_threshold: 0
      }).select().single();
      
      if (newIng) finalIngredientId = newIng.id;
    } else {
      if (!form.ingredient_id) return;
    }

    if (finalIngredientId) {
      await supabase.from('recipes').insert({
        baker_id: user.id,
        product_id: product.id,
        ingredient_id: finalIngredientId,
        quantity_needed: form.quantity_needed
      });
    }
    
    setForm({ ingredient_id: '', new_name: '', unit: 'g', quantity_needed: 0 });
    loadRecipes();
  };

  const handleRemove = async (id: string) => {
    await supabase.from('recipes').delete().eq('id', id);
    loadRecipes();
  };

  const selectedIng = ingredients.find(i => i.id === form.ingredient_id);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5">
        <div>
          <h2 className="text-xl font-bold text-foreground">Recipe Setup</h2>
          <p className="text-sm text-foreground/50">Ingredients for 1x {product.name}</p>
        </div>

        {/* Existing Recipe Items */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {loading ? <p className="text-sm text-foreground/40">Loading...</p> : 
           recipes.length === 0 ? <p className="text-sm text-foreground/40 italic">No ingredients added yet.</p> :
           recipes.map(r => (
             <div key={r.id} className="flex justify-between items-center bg-muted/30 p-3 rounded-xl border border-muted/50">
               <div>
                 <p className="font-bold text-sm text-foreground">{r.ingredient?.name}</p>
                 <p className="text-xs text-foreground/50">{r.quantity_needed}{r.ingredient?.unit}</p>
               </div>
               <button onClick={() => handleRemove(r.id)} className="text-red-400 hover:text-red-600 text-lg">×</button>
             </div>
           ))
          }
        </div>

        {/* Add New Item */}
        <div className="bg-muted/30 p-3 rounded-xl border border-muted/50 space-y-3">
          <div className="flex gap-2 bg-white p-1 rounded-lg border border-muted">
            <button onClick={() => setIsNewIngredient(false)} className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${!isNewIngredient ? 'bg-primary text-white shadow-sm' : 'text-foreground/50'}`}>Select Existing</button>
            <button onClick={() => setIsNewIngredient(true)} className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${isNewIngredient ? 'bg-primary text-white shadow-sm' : 'text-foreground/50'}`}>Create New</button>
          </div>

          {isNewIngredient ? (
            <div className="flex gap-2">
              <input placeholder="New Ingredient Name" value={form.new_name} onChange={e => setForm({ ...form, new_name: e.target.value })}
                className="flex-[2] h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none" />
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                className="flex-1 h-9 px-1 rounded-lg border border-muted text-xs focus:border-primary focus:outline-none bg-white">
                {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
          ) : (
            <select value={form.ingredient_id} onChange={e => setForm({ ...form, ingredient_id: e.target.value, unit: ingredients.find(i=>i.id===e.target.value)?.unit || 'g' })}
              className="w-full h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none bg-white">
              <option value="">Select ingredient...</option>
              {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
          )}

          <div className="flex gap-2">
            <input type="number" placeholder="Qty needed" value={form.quantity_needed || ''} onChange={e => setForm({ ...form, quantity_needed: +e.target.value })}
              className="flex-1 h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none" />
            <div className="h-9 px-3 bg-white border border-muted rounded-lg flex items-center justify-center text-sm font-medium text-foreground/50">
              {isNewIngredient ? form.unit : ingredients.find(i => i.id === form.ingredient_id)?.unit || '-'}
            </div>
            <button onClick={handleAdd} disabled={(isNewIngredient ? !form.new_name : !form.ingredient_id) || form.quantity_needed <= 0} className="h-9 px-4 bg-foreground text-white font-bold text-xs rounded-lg disabled:opacity-50">
              + Add
            </button>
          </div>
        </div>

        <button onClick={onClose} className="w-full h-12 bg-muted text-foreground font-bold rounded-xl hover:bg-muted/80">
          Done
        </button>
      </div>
    </div>
  );
}
