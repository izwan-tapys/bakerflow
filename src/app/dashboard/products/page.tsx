'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  is_active: boolean;
  cogs?: number;
  prep_time: number;
  bake_time: number;
  cool_time: number;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  avg_cost_per_unit: number;
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
  const [form, setForm] = useState({ name: '', description: '', price: 0, prep_time: 30, bake_time: 45, cool_time: 60 });
  const [pendingRecipes, setPendingRecipes] = useState<PendingRecipe[]>([]);
  
  // Inline Add Ingredient State
  const [isNewIngredient, setIsNewIngredient] = useState(false);
  const [ingForm, setIngForm] = useState({ ingredient_id: '', new_name: '', unit: 'g', quantity_needed: 0 });

  // Recipe Modal State
  const [editingRecipe, setEditingRecipe] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Inline Edit State
  const [inlineEdit, setInlineEdit] = useState<{ productId: string; field: 'price' | 'time' | 'info' } | null>(null);
  const [inlineVal, setInlineVal] = useState({ name: '', description: '', price: 0, prep: 0, bake: 0, cool: 0 });

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const [prodRes, ingRes, recipeRes] = await Promise.all([
      supabase.from('products').select('*').eq('baker_id', user.id).order('created_at', { ascending: false }),
      supabase.from('ingredients').select('id, name, unit, avg_cost_per_unit').eq('baker_id', user.id).order('name'),
      supabase.from('recipes').select('product_id, ingredient_id, quantity_needed').eq('baker_id', user.id)
    ]);

    const ings = ingRes.data || [];
    const recipes = recipeRes.data || [];
    const prods = (prodRes.data || []).map(p => {
      const productRecipes = recipes.filter(r => r.product_id === p.id);
      const totalCogs = productRecipes.reduce((sum, r) => {
        const ing = ings.find(i => i.id === r.ingredient_id);
        return sum + (r.quantity_needed * (ing?.avg_cost_per_unit || 0));
      }, 0);
      return { ...p, cogs: totalCogs };
    });

    setProducts(prods);
    setIngredients(ings);
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
    if (!form.name) {
      alert("Sila masukkan nama produk.");
      return;
    }
    if (form.price <= 0) {
      alert("Sila masukkan harga produk yang sah.");
      return;
    }
    
    setSavingProduct(true);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error(userError?.message || "Sila log masuk semula.");
      }

      // 1. Insert Product
      const { data: prodData, error: prodError } = await supabase.from('products').insert({
        baker_id: user.id,
        name: form.name,
        description: form.description,
        price: form.price,
        is_active: true,
        prep_time: form.prep_time,
        bake_time: form.bake_time,
        cool_time: form.cool_time
      }).select();

      if (prodError) throw prodError;
      if (!prodData || prodData.length === 0) throw new Error("Gagal menyimpan produk. Sila cuba lagi.");

      const newProduct = prodData[0];

      // 2. Insert Recipes & New Ingredients
      for (const recipe of pendingRecipes) {
        let finalIngredientId = recipe.ingredient_id;
        
        // If it's a new ingredient, create it in inventory first
        if (recipe.new_name) {
          const { data: newIng, error: ingError } = await supabase.from('ingredients').insert({
            baker_id: user.id,
            name: recipe.new_name,
            unit: recipe.unit,
            current_stock: 0,
            avg_cost_per_unit: 0,
            low_stock_threshold: 0
          }).select();
          
          if (ingError) {
            console.error("Failed to create ingredient:", ingError);
            // We continue even if one ingredient fails, or we could throw?
            // Let's at least log it.
            continue; 
          }
          if (newIng && newIng.length > 0) finalIngredientId = newIng[0].id;
        }

        // Link to product
        if (finalIngredientId) {
          let finalQty = recipe.quantity_needed;
          const ing = ingredients.find(i => i.id === finalIngredientId);
          const baseUnit = ing?.unit || recipe.unit;
          
          // Bidirectional Conversion
          if (recipe.unit === 'kg' && baseUnit === 'g') finalQty = recipe.quantity_needed * 1000;
          else if (recipe.unit === 'g' && baseUnit === 'kg') finalQty = recipe.quantity_needed / 1000;
          else if (recipe.unit === 'L' && baseUnit === 'ml') finalQty = recipe.quantity_needed * 1000;
          else if (recipe.unit === 'ml' && baseUnit === 'L') finalQty = recipe.quantity_needed / 1000;

          const { error: recipeError } = await supabase.from('recipes').insert({
            baker_id: user.id,
            product_id: newProduct.id,
            ingredient_id: finalIngredientId,
            quantity_needed: finalQty
          });

          if (recipeError) console.error("Failed to link recipe:", recipeError);
        }
      }

      // Success!
      setForm({ name: '', description: '', price: 0, prep_time: 30, bake_time: 45, cool_time: 60 });
      setPendingRecipes([]);
      setShowAdd(false);
      loadData();
      alert("Produk berjaya disimpan! ✨");
    } catch (err: any) {
      console.error("Save Product Error:", err);
      alert("Gagal simpan: " + (err.message || "Sila semak sambungan internet anda."));
    } finally {
      setSavingProduct(false);
    }
  };

  const toggleActive = async (product: Product) => {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id);
    loadData();
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description || '',
      price: product.price,
      prep_time: product.prep_time || 30,
      bake_time: product.bake_time || 45,
      cool_time: product.cool_time || 60
    });
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct || !form.name || form.price <= 0) return;
    setSavingProduct(true);

    const { error } = await supabase.from('products').update({
      name: form.name,
      description: form.description,
      price: form.price,
      prep_time: form.prep_time,
      bake_time: form.bake_time,
      cool_time: form.cool_time
    }).eq('id', editingProduct.id);

    if (error) {
      alert('Error updating product: ' + error.message);
    } else {
      setEditingProduct(null);
      setForm({ name: '', description: '', price: 0, prep_time: 30, bake_time: 45, cool_time: 60 });
      loadData();
    }
    setSavingProduct(false);
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    await supabase.from('products').delete().eq('id', id);
    loadData();
  };

  const startInlineEdit = (product: Product, field: 'price' | 'time' | 'info') => {
    setInlineEdit({ productId: product.id, field });
    setInlineVal({
      name: product.name,
      description: product.description || '',
      price: product.price,
      prep: product.prep_time || 0,
      bake: product.bake_time || 0,
      cool: product.cool_time || 0,
    });
  };

  const saveInlineEdit = async (productId: string, field: 'price' | 'time' | 'info') => {
    let updateData = {};
    if (field === 'price') updateData = { price: inlineVal.price };
    else if (field === 'time') updateData = { prep_time: inlineVal.prep, bake_time: inlineVal.bake, cool_time: inlineVal.cool };
    else if (field === 'info') updateData = { name: inlineVal.name, description: inlineVal.description };
    
    await supabase.from('products').update(updateData).eq('id', productId);
    setInlineEdit(null);
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
                className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none bg-white" />
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
                  className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none bg-white" />
              </div>
              <div className="col-span-2 grid grid-cols-3 gap-2 mt-1">
                <div>
                  <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Prep (Min)</label>
                  <input type="number" value={form.prep_time} onChange={e => setForm({...form, prep_time: +e.target.value})}
                    className="w-full h-9 px-2 rounded-lg border border-muted focus:border-primary focus:outline-none font-bold text-xs bg-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Bake (Min)</label>
                  <input type="number" value={form.bake_time} onChange={e => setForm({...form, bake_time: +e.target.value})}
                    className="w-full h-9 px-2 rounded-lg border border-muted focus:border-primary focus:outline-none font-bold text-xs bg-white" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Cool (Min)</label>
                  <input type="number" value={form.cool_time} onChange={e => setForm({...form, cool_time: +e.target.value})}
                    className="w-full h-9 px-2 rounded-lg border border-muted focus:border-primary focus:outline-none font-bold text-xs bg-white" />
                </div>
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
                    className="flex-[2] h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none bg-white" />
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
                    className="flex-1 h-9 px-2 rounded-lg border border-muted text-sm focus:border-primary focus:outline-none bg-white" />
                  <select value={ingForm.unit} onChange={e => setIngForm({ ...ingForm, unit: e.target.value })}
                    className="w-20 h-9 px-1 rounded-lg border border-muted text-[10px] font-bold focus:border-primary focus:outline-none bg-white">
                    {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-40 bg-muted rounded-2xl animate-pulse" />)}</div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map(product => (
            <div key={product.id} className={`bg-white rounded-3xl p-5 border-2 transition-all flex flex-col gap-4 ${product.is_active ? 'border-muted/50 hover:border-primary/30' : 'border-muted/20 opacity-60'}`}>
              
              {/* Clickable Info Area - Inline Editable */}
              {inlineEdit?.productId === product.id && inlineEdit.field === 'info' ? (
                <div className="space-y-2 bg-primary/5 p-3 rounded-2xl border-2 border-primary">
                  <div>
                    <label className="text-[9px] font-black text-primary uppercase tracking-widest">Name</label>
                    <input
                      autoFocus
                      value={inlineVal.name}
                      onChange={e => setInlineVal(v => ({ ...v, name: e.target.value }))}
                      className="w-full bg-transparent font-black text-lg text-foreground outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-primary uppercase tracking-widest">Description</label>
                    <textarea
                      value={inlineVal.description}
                      onChange={e => setInlineVal(v => ({ ...v, description: e.target.value }))}
                      onBlur={() => saveInlineEdit(product.id, 'info')}
                      rows={2}
                      className="w-full bg-transparent text-xs text-foreground/70 outline-none resize-none"
                    />
                    <p className="text-[9px] text-primary/50 text-right italic">Click away to save</p>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => startInlineEdit(product, 'info')}
                  className="cursor-pointer active:scale-[0.99] transition-all hover:bg-muted/30 p-2 rounded-2xl"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-lg text-foreground leading-tight">{product.name}</h3>
                    {!product.is_active && (
                      <span className="text-[10px] uppercase font-black bg-muted text-foreground/50 px-2 py-0.5 rounded-md">Draft</span>
                    )}
                  </div>
                  <p className="text-xs text-foreground/50 line-clamp-2">{product.description || 'No description provided.'}</p>
                </div>
              )}

              {/* Stats - Inline Editable */}
              <div className="grid grid-cols-2 gap-3">
                {/* Price Box */}
                {inlineEdit?.productId === product.id && inlineEdit.field === 'price' ? (
                  <div className="bg-primary/5 rounded-2xl p-3 border-2 border-primary">
                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1">Price (RM)</p>
                    <input
                      type="number"
                      autoFocus
                      value={inlineVal.price || ''}
                      onChange={e => setInlineVal(v => ({ ...v, price: +e.target.value }))}
                      onBlur={() => saveInlineEdit(product.id, 'price')}
                      onKeyDown={e => e.key === 'Enter' && saveInlineEdit(product.id, 'price')}
                      className="w-full bg-transparent font-black text-primary text-lg outline-none border-none"
                    />
                  </div>
                ) : (
                  <div
                    onClick={() => startInlineEdit(product, 'price')}
                    className="bg-primary/5 rounded-2xl p-3 border border-primary/10 cursor-pointer hover:border-primary/40 hover:bg-primary/10 transition-all"
                  >
                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-0.5">Price</p>
                    <p className="font-black text-primary text-lg">RM {product.price.toFixed(2)}</p>
                  </div>
                )}

                {/* Time DNA Box */}
                {inlineEdit?.productId === product.id && inlineEdit.field === 'time' ? (
                  <div className="bg-muted/30 rounded-2xl p-3 border-2 border-primary/50 space-y-1">
                    <p className="text-[9px] font-black text-foreground/40 uppercase tracking-widest">Time DNA (min)</p>
                    <div className="flex gap-1">
                      <input autoFocus type="number" placeholder="Prep" value={inlineVal.prep || ''}
                        onChange={e => setInlineVal(v => ({ ...v, prep: +e.target.value }))}
                        className="w-full bg-white rounded-lg px-1.5 py-1 text-[11px] font-bold outline-none border border-muted text-center"
                      />
                      <input type="number" placeholder="Bake" value={inlineVal.bake || ''}
                        onChange={e => setInlineVal(v => ({ ...v, bake: +e.target.value }))}
                        className="w-full bg-white rounded-lg px-1.5 py-1 text-[11px] font-bold outline-none border border-muted text-center"
                      />
                      <input type="number" placeholder="Cool" value={inlineVal.cool || ''}
                        onChange={e => setInlineVal(v => ({ ...v, cool: +e.target.value }))}
                        onBlur={() => saveInlineEdit(product.id, 'time')}
                        onKeyDown={e => e.key === 'Enter' && saveInlineEdit(product.id, 'time')}
                        className="w-full bg-white rounded-lg px-1.5 py-1 text-[11px] font-bold outline-none border border-muted text-center"
                      />
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => startInlineEdit(product, 'time')}
                    className="bg-muted/30 rounded-2xl p-3 border border-muted/50 cursor-pointer hover:border-primary/40 hover:bg-muted/60 transition-all"
                  >
                    <p className="text-[9px] font-black text-foreground/30 uppercase tracking-widest mb-0.5">Time DNA</p>
                    <p className="font-bold text-foreground/70 text-xs">🥣{product.prep_time}m 🔥{product.bake_time}m ❄️{product.cool_time}m</p>
                  </div>
                )}
              </div>

              {/* Profitability DNA */}
              <div className="bg-muted/20 rounded-2xl p-3 flex justify-between items-center border border-muted/50">
                <div>
                  <p className="text-[9px] font-black text-foreground/30 uppercase tracking-widest">COGS (Cost)</p>
                  <p className="text-xs font-bold text-foreground/70">RM {product.cogs?.toFixed(2) || '0.00'}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-foreground/30 uppercase tracking-widest">Margin</p>
                  {product.price > 0 ? (
                    <p className={`text-xs font-black ${((product.price - (product.cogs || 0)) / product.price) > 0.4 ? 'text-green-500' : 'text-orange-500'}`}>
                      {(((product.price - (product.cogs || 0)) / product.price) * 100).toFixed(0)}%
                    </p>
                  ) : (
                    <p className="text-xs font-black text-foreground/30">-</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingRecipe(product)}
                  className="flex-1 h-10 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 transition-all"
                >
                  📝 Recipe
                </button>
                <button
                  onClick={() => toggleActive(product)}
                  className={`flex-1 h-10 rounded-xl text-xs font-bold transition-all ${product.is_active ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-muted text-foreground/40'}`}
                >
                  {product.is_active ? '✅ Active' : '❌ Hidden'}
                </button>
                <button
                  onClick={() => deleteProduct(product.id)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-red-400 hover:bg-red-50 transition-all"
                >
                  🗑️
                </button>
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

      {/* Edit Product Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground">Edit Product</h2>
              <p className="text-sm text-foreground/50">Update details for {editingProduct.name}</p>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground/70 block mb-1">Product Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground/70 block mb-1">Price (RM)</label>
                <input type="number" value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Prep (Min)</label>
                  <input type="number" value={form.prep_time} onChange={e => setForm({...form, prep_time: +e.target.value})}
                    className="w-full h-11 px-2 rounded-xl border border-muted focus:border-primary outline-none font-bold text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Bake (Min)</label>
                  <input type="number" value={form.bake_time} onChange={e => setForm({...form, bake_time: +e.target.value})}
                    className="w-full h-11 px-2 rounded-xl border border-muted focus:border-primary outline-none font-bold text-sm" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Cool (Min)</label>
                  <input type="number" value={form.cool_time} onChange={e => setForm({...form, cool_time: +e.target.value})}
                    className="w-full h-11 px-2 rounded-xl border border-muted focus:border-primary outline-none font-bold text-sm" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={() => { setEditingProduct(null); setForm({ name: '', description: '', price: 0, prep_time: 30, bake_time: 45, cool_time: 60 }); }} className="flex-1 h-12 rounded-xl border border-muted font-bold">Cancel</button>
              <button onClick={handleUpdateProduct} disabled={savingProduct} className="flex-[2] h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20">
                {savingProduct ? 'Updating...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
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
    if (form.quantity_needed <= 0) {
      alert("Sila masukkan kuantiti yang sah.");
      return;
    }
    
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error(userError?.message || "Sila log masuk semula.");
      
      let finalIngredientId = form.ingredient_id;
      
      if (isNewIngredient) {
        if (!form.new_name) {
          alert("Sila masukkan nama bahan.");
          setLoading(false);
          return;
        }
        const { data: newIng, error: ingError } = await supabase.from('ingredients').insert({
          baker_id: user.id,
          name: form.new_name,
          unit: form.unit,
          current_stock: 0,
          avg_cost_per_unit: 0,
          low_stock_threshold: 0
        }).select();
        
        if (ingError) throw ingError;
        if (newIng && newIng.length > 0) finalIngredientId = newIng[0].id;
      } else {
        if (!form.ingredient_id) {
          alert("Sila pilih bahan dari senarai.");
          setLoading(false);
          return;
        }
      }

      if (finalIngredientId) {
        let finalQty = form.quantity_needed;
        const baseUnit = isNewIngredient ? form.unit : ingredients.find(i => i.id === finalIngredientId)?.unit;
        
        // Bidirectional Conversion
        if (form.unit === 'kg' && baseUnit === 'g') finalQty = form.quantity_needed * 1000;
        else if (form.unit === 'g' && baseUnit === 'kg') finalQty = form.quantity_needed / 1000;
        else if (form.unit === 'L' && baseUnit === 'ml') finalQty = form.quantity_needed * 1000;
        else if (form.unit === 'ml' && baseUnit === 'L') finalQty = form.quantity_needed / 1000;

        const { error: recipeError } = await supabase.from('recipes').insert({
          baker_id: user.id,
          product_id: product.id,
          ingredient_id: finalIngredientId,
          quantity_needed: finalQty
        });

        if (recipeError) throw recipeError;
      }
      
      setForm({ ingredient_id: '', new_name: '', unit: 'g', quantity_needed: 0 });
      loadRecipes();
    } catch (err: any) {
      console.error("Recipe Add Error:", err);
      alert("Gagal tambah bahan: " + (err.message || "Sila cuba lagi."));
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id: string) => {
    await supabase.from('recipes').delete().eq('id', id);
    loadRecipes();
  };

  const handleSaveAll = async () => {
    onClose();
  };

  const selectedIng = ingredients.find(i => i.id === form.ingredient_id);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center">
      <div className="bg-white w-full max-w-md md:rounded-3xl rounded-t-[40px] p-6 shadow-2xl flex flex-col h-[calc(100vh-120px)] md:h-auto md:max-h-[85vh] mb-[72px] md:mb-0 overflow-hidden">
        <div className="flex-none mb-4">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-black text-foreground">Recipe Setup</h2>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-muted rounded-full text-foreground/40 text-xl font-bold">&times;</button>
          </div>
          <p className="text-sm text-foreground/50">Details for {product.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar">
          <div className="space-y-3">
            <p className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">🥣 Ingredients List</p>
            {/* Existing Recipe Items - SCROLLABLE (max 3 items visible) */}
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {loading ? <p className="text-sm text-foreground/40 text-center py-4">Loading...</p> : 
               recipes.length === 0 ? <p className="text-sm text-foreground/40 italic text-center py-4">No ingredients added yet.</p> :
               recipes.map(r => (
                 <div key={r.id} className="flex justify-between items-center bg-muted/30 p-3 rounded-xl border border-muted/50">
                   <div>
                     <p className="font-bold text-sm text-foreground">{r.ingredient?.name}</p>
                     <p className="text-xs text-foreground/50">{r.quantity_needed}{r.ingredient?.unit}</p>
                   </div>
                   <button onClick={() => handleRemove(r.id)} className="text-red-400 hover:text-red-600 text-lg px-2">×</button>
                 </div>
               ))
              }
            </div>
          </div>

          {/* Add New Item */}
          <div className="bg-muted/30 p-3 rounded-xl border border-muted/50 space-y-3">
            <div className="flex gap-2 bg-white p-1 rounded-lg border border-muted">
              <button onClick={() => setIsNewIngredient(false)} className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${!isNewIngredient ? 'bg-primary text-white shadow-sm' : 'text-foreground/50'}`}>Select Existing</button>
              <button onClick={() => setIsNewIngredient(true)} className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${isNewIngredient ? 'bg-primary text-white shadow-sm' : 'text-foreground/50'}`}>Create New</button>
            </div>

            {isNewIngredient ? (
              <div>
                <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Ingredient Name</label>
                <input placeholder="e.g. Premium Butter" value={form.new_name} onChange={e => setForm({ ...form, new_name: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary outline-none bg-white" />
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Select Ingredient</label>
                <select value={form.ingredient_id} onChange={e => setForm({ ...form, ingredient_id: e.target.value, unit: ingredients.find(i=>i.id===e.target.value)?.unit || 'g' })}
                  className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary outline-none bg-white">
                  <option value="">Choose from inventory...</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                </select>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Qty</label>
                <input type="number" placeholder="0" value={form.quantity_needed || ''} onChange={e => setForm({ ...form, quantity_needed: e.target.value === '' ? 0 : +e.target.value })}
                  className="w-full h-10 px-2 rounded-xl border border-muted text-sm focus:border-primary outline-none bg-white" />
              </div>
              <div className="w-20">
                <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Unit</label>
                <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                  className="w-full h-10 px-1 rounded-xl border border-muted text-[10px] font-bold focus:border-primary outline-none bg-white">
                  {['g', 'kg', 'ml', 'L', 'pcs', 'tbsp', 'tsp'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <button onClick={handleAdd} disabled={(isNewIngredient ? !form.new_name : !form.ingredient_id) || form.quantity_needed <= 0}
                className="h-10 px-4 bg-foreground text-white font-bold text-xs rounded-xl disabled:opacity-50 hover:bg-black transition-colors">
                + Add
              </button>
            </div>
          </div>
        </div>

        <div className="flex-none pt-2">
          <button onClick={handleSaveAll} className="w-full h-12 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
            Close & Update
          </button>
        </div>
      </div>
    </div>
  );
}
