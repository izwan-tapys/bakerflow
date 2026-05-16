'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  brand?: string | null;
  unit: string;
  avg_cost_per_unit: number;
}

interface Recipe {
  id: string;
  ingredient_id: string;
  quantity_needed: number;
}

interface PendingRecipe {
  ingredient_id?: string;
  new_name?: string;
  brand?: string | null;
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
  const [ingSearch, setIngSearch] = useState('');
  const [showIngSuggestions, setShowIngSuggestions] = useState(false);
  const [catalogSuggestions, setCatalogSuggestions] = useState<any[]>([]);
  const [searchingCatalog, setSearchingCatalog] = useState(false);
  const [ingForm, setIngForm] = useState({ ingredient_id: '', brand: '', unit: 'g', quantity_needed: 0 });

  // Recipe Modal State
  const [editingRecipe, setEditingRecipe] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [expandedId, setExpandedId] = useState<string | null>(null);
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
    if (ingForm.quantity_needed <= 0 || !ingSearch) return;
    
    const existing = ingredients.find(i => i.id === ingForm.ingredient_id || i.name.toLowerCase() === ingSearch.toLowerCase());

    if (existing) {
      setPendingRecipes(prev => [...prev, {
        ingredient_id: existing.id,
        unit: ingForm.unit,
        quantity_needed: ingForm.quantity_needed,
        display_name: existing.name
      }]);
    } else {
      setPendingRecipes(prev => [...prev, {
        new_name: ingSearch,
        brand: ingForm.brand || null,
        unit: ingForm.unit,
        quantity_needed: ingForm.quantity_needed,
        display_name: ingForm.brand ? `${ingSearch} (@${ingForm.brand})` : ingSearch
      }]);
    }
    
    // Reset ingredient form
    setIngForm({ ingredient_id: '', brand: '', unit: 'g', quantity_needed: 0 });
    setIngSearch('');
    setShowIngSuggestions(false);
  };

  const removePendingRecipe = (index: number) => {
    setPendingRecipes(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveProduct = async () => {
    console.log("Saving product with recipes...", pendingRecipes);
    // 0. Auto-add current input if forgot to click ADD
    if (ingSearch && ingForm.quantity_needed > 0) {
      const existing = ingredients.find(i => i.id === ingForm.ingredient_id || i.name.toLowerCase() === ingSearch.toLowerCase());
      const newPending = existing 
        ? { ingredient_id: existing.id, unit: ingForm.unit, quantity_needed: ingForm.quantity_needed, display_name: existing.name }
        : { new_name: ingSearch, brand: ingForm.brand || null, unit: ingForm.unit, quantity_needed: ingForm.quantity_needed, display_name: ingSearch };
      
      const finalPending = [...pendingRecipes, newPending];
      await processSave(finalPending);
    } else {
      await processSave(pendingRecipes);
    }
  };

  const processSave = async (recipesToSave: PendingRecipe[]) => {
    if (!form.name || form.price <= 0) {
      alert("Sila masukkan nama dan harga produk.");
      return;
    }
    
    setSavingProduct(true);
    
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Sila log masuk semula.");

      console.log("1. Creating Product...");
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
      const newProduct = prodData[0];
      console.log("Product created:", newProduct.id);

      // 2. Insert Recipes & New Ingredients
      console.log(`2. Processing ${recipesToSave.length} recipes...`);
      for (const recipe of recipesToSave) {
        let finalIngredientId = recipe.ingredient_id;
        
        if (recipe.new_name) {
          console.log(`Creating new ingredient: ${recipe.new_name}`);
          const { data: newIng, error: ingError } = await supabase.from('ingredients').insert({
            baker_id: user.id,
            name: recipe.new_name,
            brand: recipe.brand || null,
            unit: recipe.unit,
            current_stock: 0,
            avg_cost_per_unit: 0,
            low_stock_threshold: 0
          }).select();
          
          if (ingError) {
            console.error("Ingredient Insert Error:", ingError);
            throw ingError;
          }
          if (newIng && newIng.length > 0) finalIngredientId = newIng[0].id;
        }

        if (finalIngredientId) {
          console.log(`Linking recipe for ingredient ID: ${finalIngredientId}`);
          let finalQty = recipe.quantity_needed;
          const ing = ingredients.find(i => i.id === finalIngredientId);
          const baseUnit = ing?.unit || recipe.unit;
          
          if (recipe.unit === 'kg' && baseUnit === 'g') finalQty *= 1000;
          else if (recipe.unit === 'g' && baseUnit === 'kg') finalQty /= 1000;
          else if (recipe.unit === 'L' && baseUnit === 'ml') finalQty *= 1000;
          else if (recipe.unit === 'ml' && baseUnit === 'L') finalQty /= 1000;

          const { error: recipeError } = await supabase.from('recipes').insert({
            baker_id: user.id,
            product_id: newProduct.id,
            ingredient_id: finalIngredientId,
            quantity_needed: finalQty
          });
          if (recipeError) {
            console.error("Recipe Link Error:", recipeError);
            throw recipeError;
          }
        } else {
          console.warn("Skipping recipe: finalIngredientId is missing", recipe);
        }
      }

      setForm({ name: '', description: '', price: 0, prep_time: 30, bake_time: 45, cool_time: 60 });
      setPendingRecipes([]);
      setIngSearch('');
      setShowAdd(false);
      await loadData();
      alert("Produk & Resepi berjaya disimpan! ✨");
    } catch (err: any) {
      console.error("Critical Save Error:", err);
      alert("Gagal simpan: " + (err.message || "Ralat tidak diketahui"));
    } finally {
      setSavingProduct(false);
    }
  };

  const toggleActive = async (product: Product) => {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id);
    loadData();
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
    if (!confirm('Adakah anda pasti nak padam produk ini? Semua rekod resipi berkaitan juga akan dipadam.')) return;
    
    // First, try to delete recipes (cascade-like behavior in app logic if DB doesn't have it)
    await supabase.from('recipes').delete().eq('product_id', id);
    
    const { error } = await supabase.from('products').delete().eq('id', id);
    
    if (error) {
      if (error.code === '23503') {
        alert('Gagal Padam: Produk ini sudah ada dalam rekod Order. Sila tukar status kepada "Hidden" jika tidak mahu menjualnya lagi.');
      } else {
        alert('Gagal Padam: ' + error.message);
      }
    } else {
      loadData();
    }
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

      {/* Tab Switcher */}
      <div className="flex bg-muted/30 p-1 rounded-xl border border-muted/50 w-full sm:w-64">
        <button onClick={() => setActiveTab('active')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'active' ? 'bg-white text-primary shadow-sm' : 'text-foreground/40'}`}>
          Active Menu
        </button>
        <button onClick={() => setActiveTab('archived')} className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${activeTab === 'archived' ? 'bg-white text-primary shadow-sm' : 'text-foreground/40'}`}>
          Archived
        </button>
      </div>

      {/* Add Form with Inline Recipe */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-[10%] md:p-[15%] lg:p-[20%] pb-[90px] md:pb-[15%] lg:pb-[20%]">
          <div className="bg-white w-full h-full rounded-[24px] p-8 shadow-2xl flex flex-col overflow-hidden border border-white/20">
            <div className="flex justify-between items-center mb-6 flex-none">
              <p className="text-xl font-black text-primary">Add New Product</p>
              <button onClick={() => setShowAdd(false)} className="w-10 h-10 flex items-center justify-center bg-muted rounded-full text-foreground/40 text-xl font-bold">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-foreground/40 uppercase tracking-widest block mb-1.5">Product Name</label>
                  <input placeholder="e.g. Chocolate Moist Cake" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
                </div>
                <div>
                  <label className="text-xs font-black text-foreground/40 uppercase tracking-widest block mb-1.5">Description</label>
                  <textarea placeholder="e.g. Rich chocolate cake..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                    className="w-full py-3 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-medium resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs font-black text-foreground/40 uppercase tracking-widest block mb-1.5">Price (RM)</label>
                    <input type="number" value={form.price || ''} onChange={e => setForm({ ...form, price: +e.target.value })}
                      className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-black text-lg text-primary" />
                  </div>
                  <div className="col-span-2 grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <label className="text-[10px] font-black text-foreground/30 uppercase mb-1 block">Prep (Min)</label>
                      <input type="number" value={form.prep_time} onChange={e => setForm({...form, prep_time: +e.target.value})} className="w-full h-10 px-2 rounded-lg border-2 border-muted text-center font-bold" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-foreground/30 uppercase mb-1 block">Bake (Min)</label>
                      <input type="number" value={form.bake_time} onChange={e => setForm({...form, bake_time: +e.target.value})} className="w-full h-10 px-2 rounded-lg border-2 border-muted text-center font-bold" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-foreground/30 uppercase mb-1 block">Cool (Min)</label>
                      <input type="number" value={form.cool_time} onChange={e => setForm({...form, cool_time: +e.target.value})} className="w-full h-10 px-2 rounded-lg border-2 border-muted text-center font-bold" />
                    </div>
                  </div>
                </div>

                <div className="border-t-2 border-muted pt-6 space-y-4">
                  <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Recipe Ingredients</p>
                  {pendingRecipes.length > 0 && (
                    <div className="space-y-2">
                      {pendingRecipes.map((r, idx) => (
                        <div key={idx} className="flex justify-between items-center bg-muted/20 px-4 py-3 rounded-xl border border-muted/50">
                          <div>
                            <p className="font-bold text-sm">{r.display_name}</p>
                            <p className="text-[10px] font-black text-foreground/30 uppercase">{r.quantity_needed}{r.unit}</p>
                          </div>
                          <button onClick={() => removePendingRecipe(idx)} className="text-red-400 text-2xl font-bold">×</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-muted/10 p-5 rounded-2xl border-2 border-muted/30 space-y-4">
                    <div className="relative">
                      <label className="text-[10px] font-black text-foreground/30 uppercase mb-1.5 block">Search Ingredient</label>
                      <input 
                        placeholder="Type name..." 
                        value={ingSearch} 
                        onChange={async (e) => { 
                          const val = e.target.value;
                          setIngSearch(val); 
                          setShowIngSuggestions(true);
                          
                          if (val.length > 1) {
                            setSearchingCatalog(true);
                            const { data } = await supabase.from('master_catalog').select('*').ilike('name', `%${val}%`).limit(5);
                            setCatalogSuggestions(data || []);
                            setSearchingCatalog(false);
                          } else {
                            setCatalogSuggestions([]);
                          }
                        }} 
                        onFocus={() => setShowIngSuggestions(true)} 
                        className="w-full h-11 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" 
                      />
                      {showIngSuggestions && (ingSearch || catalogSuggestions.length > 0) && (
                        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-muted rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                          {/* LOCAL INVENTORY SUGGESTIONS */}
                          {ingredients.filter(i => i.name.toLowerCase().includes(ingSearch.toLowerCase())).map(i => (
                            <div key={i.id} onClick={() => { 
                              setIngSearch(i.name); 
                              setIngForm({ ...ingForm, ingredient_id: i.id, brand: i.brand || '', unit: i.unit }); 
                              setShowIngSuggestions(false); 
                            }} className="px-4 py-2.5 hover:bg-primary/5 cursor-pointer border-b border-muted/30 last:border-0 font-bold text-sm">
                              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded mr-2 uppercase">Your Stock</span>
                              {i.name} <span className="text-[10px] opacity-30">({i.unit})</span>
                            </div>
                          ))}

                          {/* CATALOG SUGGESTIONS */}
                          {catalogSuggestions.map((c, i) => (
                            <div key={`cat-${i}`} onClick={() => {
                              setIngSearch(c.name);
                              setIngForm({ ...ingForm, ingredient_id: '', brand: c.brand || '', unit: c.unit });
                              setShowIngSuggestions(false);
                            }} className="px-4 py-2.5 hover:bg-blue-50/50 cursor-pointer border-b border-muted/30 last:border-0 font-bold text-sm">
                              <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded mr-2 uppercase">Catalog</span>
                              {c.name} <span className="text-[10px] opacity-30">({c.unit})</span>
                            </div>
                          ))}

                          {searchingCatalog && (
                            <div className="px-4 py-2 text-[10px] text-foreground/30 animate-pulse italic">Searching catalog...</div>
                          )}

                          {!ingredients.some(i => i.name.toLowerCase() === ingSearch.toLowerCase()) && !catalogSuggestions.some(c => c.name.toLowerCase() === ingSearch.toLowerCase()) && ingSearch && (
                            <div onClick={() => setShowIngSuggestions(false)} className="px-4 py-3 hover:bg-green-50 cursor-pointer transition-colors border-t border-muted/30">
                              <div className="flex items-center gap-3 text-green-600">
                                <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center font-bold text-xs">+</div>
                                <div>
                                  <p className="text-sm font-bold">Add &quot;{ingSearch}&quot; as new custom</p>
                                  <p className="text-[10px] opacity-70 font-medium">Will be created on save</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] font-black text-foreground/30 uppercase mb-1 block">Qty</label>
                        <input type="number" value={ingForm.quantity_needed || ''} onChange={e => setIngForm({ ...ingForm, quantity_needed: +e.target.value })} className="w-full h-10 px-3 rounded-lg border-2 border-muted font-bold" />
                      </div>
                      <div className="w-20">
                        <label className="text-[10px] font-black text-foreground/30 uppercase mb-1 block">Unit</label>
                        <select value={ingForm.unit} onChange={e => setIngForm({ ...ingForm, unit: e.target.value })} className="w-full h-10 px-1 rounded-lg border-2 border-muted font-bold text-xs bg-white">
                          {['g', 'kg', 'ml', 'L', 'pcs'].map(u => <option key={u}>{u}</option>)}
                        </select>
                      </div>
                      <button onClick={handleAddPendingRecipe} disabled={!ingSearch || ingForm.quantity_needed <= 0} className="h-10 mt-5 px-4 bg-foreground text-white font-black text-[10px] rounded-lg">ADD</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6 flex-none">
              <button onClick={handleSaveProduct} disabled={!form.name || form.price <= 0 || savingProduct} className="w-full h-16 bg-primary text-white rounded-xl font-black text-lg shadow-xl shadow-primary/20">
                {savingProduct ? 'SAVING...' : 'SAVE PRODUCT & RECIPE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product List - Table Style */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-muted rounded-2xl animate-pulse" />)}
        </div>
      ) : products.filter(p => activeTab === 'active' ? p.is_active : !p.is_active).length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-muted mt-4">
          <div className="text-5xl mb-3">{activeTab === 'active' ? '🍩' : '📦'}</div>
          <p className="font-bold text-foreground">
            {activeTab === 'active' ? 'Your active menu is empty' : 'No archived products'}
          </p>
          {activeTab === 'active' && (
            <button onClick={() => setShowAdd(true)} className="text-primary font-black text-sm uppercase tracking-widest mt-2">+ Add First Product</button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-muted/50 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-muted/50">
                  <th className="sticky top-0 z-20 bg-muted px-6 py-3 text-[10px] font-black uppercase text-foreground/40 tracking-widest">Product</th>
                  <th className="sticky top-0 z-20 bg-muted px-6 py-3 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right">Price (RM)</th>
                  <th className="sticky top-0 z-20 bg-muted px-6 py-3 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.filter(p => activeTab === 'active' ? p.is_active : !p.is_active).map(product => (
                  <React.Fragment key={product.id}>
                    <tr 
                      onClick={() => setExpandedId(expandedId === product.id ? null : product.id)}
                      className={`group cursor-pointer transition-colors hover:bg-muted/10 border-b border-muted/20 ${expandedId === product.id ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] transition-transform duration-300 ${expandedId === product.id ? 'rotate-90' : ''}`}>▶</span>
                          <p className="font-black text-foreground text-sm leading-tight">{product.name}</p>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-right font-black text-primary text-sm">
                        {product.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center">
                          <button
                            onClick={() => toggleActive(product)}
                            className={`relative w-10 h-5 rounded-full transition-all duration-300 shadow-inner ${product.is_active ? 'bg-green-500' : 'bg-red-500'}`}
                          >
                            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-300 ${product.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    
                    {/* Expanded Section */}
                    {expandedId === product.id && (
                      <tr className="bg-muted/5">
                        <td colSpan={4} className="px-12 py-8 border-b border-muted/20">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <div>
                                <p className="text-[9px] font-black uppercase text-foreground/30 tracking-widest mb-2">Description</p>
                                <p className="text-sm text-foreground/70 font-medium leading-relaxed">{product.description || 'No description provided.'}</p>
                              </div>
                              <div className="grid grid-cols-3 gap-4 p-3 bg-white/50 rounded-xl border border-muted/30">
                                <div>
                                  <p className="text-[8px] font-black uppercase text-foreground/30 tracking-widest mb-0.5">Prep</p>
                                  <p className="text-xs font-bold text-foreground/70">🥣 {product.prep_time}m</p>
                                </div>
                                <div>
                                  <p className="text-[8px] font-black uppercase text-foreground/30 tracking-widest mb-0.5">Bake</p>
                                  <p className="text-xs font-bold text-foreground/70">🔥 {product.bake_time}m</p>
                                </div>
                                <div>
                                  <p className="text-[8px] font-black uppercase text-foreground/30 tracking-widest mb-0.5">Cool</p>
                                  <p className="text-xs font-bold text-foreground/70">❄️ {product.cool_time}m</p>
                                </div>
                              </div>
                              <div className="flex gap-8">
                                <div>
                                  <p className="text-[9px] font-black uppercase text-foreground/30 tracking-widest mb-1">COGS (Cost)</p>
                                  <p className="text-sm font-bold text-foreground/70">RM {product.cogs?.toFixed(2) || '0.00'}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-black uppercase text-foreground/30 tracking-widest mb-1">Margin</p>
                                  <p className={`text-sm font-black ${((product.price - (product.cogs || 0)) / product.price) > 0.4 ? 'text-green-500' : 'text-orange-500'}`}>
                                    {product.price > 0 ? `${(((product.price - (product.cogs || 0)) / product.price) * 100).toFixed(0)}%` : '-'}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-3 justify-end items-end">
                              <div className="flex gap-2 w-full max-w-[280px]">
                                <button
                                  onClick={() => setEditingRecipe(product)}
                                  className="flex-1 h-12 rounded-xl text-xs font-black bg-primary text-white shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                                >
                                  📝 EDIT RECIPE
                                </button>
                                <button
                                  onClick={() => deleteProduct(product.id)}
                                  className="w-12 h-12 rounded-xl flex items-center justify-center bg-red-50 text-red-400 hover:bg-red-100 transition-all"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
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
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-[10%] md:p-[15%] lg:p-[20%] pb-[90px] md:pb-[15%] lg:pb-[20%]">
          <div className="bg-white w-full h-full rounded-[24px] p-8 shadow-2xl flex flex-col overflow-hidden border border-white/20">
            <div className="flex justify-between items-center mb-6 flex-none">
              <h2 className="text-xl font-black text-primary">Edit Product</h2>
              <button onClick={() => { setEditingProduct(null); setForm({ name: '', description: '', price: 0, prep_time: 30, bake_time: 45, cool_time: 60 }); }} className="w-10 h-10 flex items-center justify-center bg-muted rounded-full text-foreground/40 text-xl font-bold">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-5">
              <div>
                <label className="text-xs font-black text-foreground/40 uppercase tracking-widest block mb-1.5">Product Name</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold" />
              </div>
              <div>
                <label className="text-xs font-black text-foreground/40 uppercase tracking-widest block mb-1.5">Price (RM)</label>
                <input type="number" value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })}
                  className="w-full h-12 px-4 rounded-xl border-2 border-muted focus:border-primary outline-none font-black text-lg text-primary" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-black text-foreground/30 uppercase mb-1 block">Prep (Min)</label>
                  <input type="number" value={form.prep_time} onChange={e => setForm({...form, prep_time: +e.target.value})}
                    className="w-full h-11 px-2 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold text-sm text-center" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-foreground/30 uppercase mb-1 block">Bake (Min)</label>
                  <input type="number" value={form.bake_time} onChange={e => setForm({...form, bake_time: +e.target.value})}
                    className="w-full h-11 px-2 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold text-sm text-center" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-foreground/30 uppercase mb-1 block">Cool (Min)</label>
                  <input type="number" value={form.cool_time} onChange={e => setForm({...form, cool_time: +e.target.value})}
                    className="w-full h-11 px-2 rounded-xl border-2 border-muted focus:border-primary outline-none font-bold text-sm text-center" />
                </div>
              </div>
            </div>

            <div className="pt-6 flex-none">
              <button onClick={handleUpdateProduct} disabled={savingProduct} className="w-full h-16 bg-primary text-white font-black rounded-xl shadow-xl shadow-primary/20 transition-all">
                {savingProduct ? 'UPDATING...' : 'SAVE CHANGES'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecipeModal({ product, ingredients, onClose }: { product: Product, ingredients: Ingredient[], onClose: () => void }) {
  // Saved recipes loaded from DB (existing)
  const [savedRecipes, setSavedRecipes] = useState<Recipe[]>([]);
  // Pending new recipes to be added (not yet in DB)
  const [pendingRecipes, setPendingRecipes] = useState<PendingRecipe[]>([]);
  // IDs to delete on save
  const [toDelete, setToDelete] = useState<string[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [ingSearch, setIngSearch] = useState('');
  const [showIngSuggestions, setShowIngSuggestions] = useState(false);
  const [catalogSuggestions, setCatalogSuggestions] = useState<any[]>([]);
  const [searchingCatalog, setSearchingCatalog] = useState(false);
  const [form, setForm] = useState({ ingredient_id: '', brand: '', unit: 'g', quantity_needed: 0 });

  // Load existing recipes from DB on open
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('recipes')
        .select('id, ingredient_id, quantity_needed')
        .eq('product_id', product.id);
      setSavedRecipes(data || []);
      setLoading(false);
    };
    load();
  }, [product.id]);

  // Combined list: saved (minus deleted) + pending
  const allRecipes = [
    ...savedRecipes.filter(r => !toDelete.includes(r.id)),
    ...pendingRecipes.map((p, i) => ({
      id: `pending-${i}`,
      ingredient_id: p.ingredient_id || '',
      quantity_needed: p.quantity_needed,
      _pending: true,
      _pendingIdx: i,
      _display_name: p.display_name,
      _new_name: p.new_name,
      _unit: p.unit,
    }))
  ];

  // Group by ingredient_id (for saved) or by display_name (for pending)
  const grouped = allRecipes.reduce((acc: any[], r: any) => {
    const key = r._pending ? r._display_name : r.ingredient_id;
    const existing = acc.find(item => item.key === key);
    if (existing) {
      existing.quantity_needed += r.quantity_needed;
      if (!r._pending) existing.savedIds.push(r.id);
      if (r._pending) existing.pendingIdxs.push(r._pendingIdx);
    } else {
      const ing = !r._pending ? ingredients.find(i => i.id === r.ingredient_id) : null;
      acc.push({
        key,
        ingredient_id: r.ingredient_id,
        display_name: r._pending ? r._display_name : (ing?.name || r.ingredient_id),
        unit: r._pending ? r._unit : (ing?.unit || ''),
        quantity_needed: r.quantity_needed,
        savedIds: r._pending ? [] : [r.id],
        pendingIdxs: r._pending ? [r._pendingIdx] : [],
      });
    }
    return acc;
  }, []);

  const handleAdd = () => {
    if (!ingSearch || form.quantity_needed <= 0) return;
    const existing = ingredients.find(i => i.id === form.ingredient_id || i.name.toLowerCase() === ingSearch.toLowerCase());
    const newPending: PendingRecipe = existing
      ? { ingredient_id: existing.id, unit: form.unit, quantity_needed: form.quantity_needed, display_name: existing.name }
      : { new_name: ingSearch, brand: form.brand || null, unit: form.unit, quantity_needed: form.quantity_needed, display_name: ingSearch };
    setPendingRecipes(prev => [...prev, newPending]);
    setForm({ ingredient_id: '', brand: '', unit: 'g', quantity_needed: 0 });
    setIngSearch('');
    setShowIngSuggestions(false);
  };

  const handleRemove = (group: any) => {
    if (group.savedIds.length > 0) setToDelete(prev => [...prev, ...group.savedIds]);
    if (group.pendingIdxs.length > 0) {
      setPendingRecipes(prev => prev.filter((_, i) => !group.pendingIdxs.includes(i)));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sila log masuk semula.");

      // Delete removed items
      if (toDelete.length > 0) {
        await supabase.from('recipes').delete().in('id', toDelete);
      }

      // Insert pending items
      for (const recipe of pendingRecipes) {
        let finalIngredientId = recipe.ingredient_id;

        if (recipe.new_name) {
          const { data: newIng } = await supabase.from('ingredients').insert({
            baker_id: user.id,
            name: recipe.new_name,
            brand: recipe.brand || null,
            unit: recipe.unit,
            current_stock: 0,
            avg_cost_per_unit: 0,
            low_stock_threshold: 0
          }).select();
          if (newIng && newIng.length > 0) finalIngredientId = newIng[0].id;
        }

        if (finalIngredientId) {
          await supabase.from('recipes').insert({
            baker_id: user.id,
            product_id: product.id,
            ingredient_id: finalIngredientId,
            quantity_needed: recipe.quantity_needed
          });
        }
      }

      onClose();
    } catch (err: any) {
      alert("Gagal simpan resepi: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-[10%] md:p-[15%] lg:p-[20%] pb-[90px] md:pb-[15%] lg:pb-[20%]">
      <div className="bg-white w-full h-full rounded-[24px] p-8 shadow-2xl flex flex-col overflow-hidden border border-white/20">
        <div className="flex-none mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-black text-primary">Recipe Setup</h2>
            <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-muted rounded-full text-foreground/40 text-xl font-bold">&times;</button>
          </div>
          <p className="text-sm font-bold text-foreground/50 italic">{product.name}</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1 custom-scrollbar">
          {/* Ingredient List */}
          <div className="space-y-3">
            <p className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">🥣 Ingredients List</p>
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {loading ? (
                <p className="text-sm text-foreground/40 text-center py-4">Loading...</p>
              ) : grouped.length === 0 ? (
                <p className="text-sm text-foreground/40 italic text-center py-4">No ingredients added yet.</p>
              ) : grouped.map(r => (
                <div key={r.key} className="flex justify-between items-center bg-muted/30 p-3 rounded-xl border border-muted/50">
                  <div>
                    <p className="font-bold text-sm text-foreground">{r.display_name}</p>
                    <p className="text-xs text-foreground/50">{r.quantity_needed} {r.unit}</p>
                  </div>
                  <button onClick={() => handleRemove(r)} className="text-red-400 hover:text-red-600 text-lg px-2">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Add New Item */}
          <div className="bg-muted/10 p-4 rounded-2xl border-2 border-muted/30 space-y-4">
            <p className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">+ Add Ingredient</p>
            <div className="flex gap-2">
              <div className="flex-[2] relative">
                <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Search or Add Ingredient</label>
                <input
                  placeholder="Type ingredient name..."
                  value={ingSearch}
                  onChange={async (e) => { 
                    const val = e.target.value;
                    setIngSearch(val); 
                    setForm({ ...form, ingredient_id: '' }); 
                    setShowIngSuggestions(true); 

                    if (val.length > 1) {
                      setSearchingCatalog(true);
                      const { data } = await supabase.from('master_catalog').select('*').ilike('name', `%${val}%`).limit(5);
                      setCatalogSuggestions(data || []);
                      setSearchingCatalog(false);
                    } else {
                      setCatalogSuggestions([]);
                    }
                  }}
                  onFocus={() => setShowIngSuggestions(true)}
                  className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none bg-white"
                />
                {showIngSuggestions && (ingSearch || catalogSuggestions.length > 0) && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-muted rounded-xl shadow-xl max-h-60 overflow-y-auto">
                    {/* LOCAL */}
                    {ingredients.filter(i => i.name.toLowerCase().includes(ingSearch.toLowerCase())).map(i => (
                      <div key={i.id} onClick={() => { 
                        setIngSearch(i.name); 
                        setForm({ ...form, ingredient_id: i.id, brand: i.brand || '', unit: i.unit }); 
                        setShowIngSuggestions(false); 
                      }}
                        className="px-4 py-2 hover:bg-primary/5 cursor-pointer text-sm font-medium border-b border-muted/30 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] bg-muted px-1 py-0.5 rounded uppercase">Your Stock</span>
                          <p className="text-foreground">{i.name}</p>
                          {i.brand && <span className="text-[10px] text-primary/50 font-bold bg-primary/5 px-1.5 py-0.5 rounded">@{i.brand}</span>}
                        </div>
                      </div>
                    ))}
                    {/* CATALOG */}
                    {catalogSuggestions.map((c, i) => (
                      <div key={`cat-mod-${i}`} onClick={() => {
                        setIngSearch(c.name);
                        setForm({ ...form, ingredient_id: '', brand: c.brand || '', unit: c.unit });
                        setShowIngSuggestions(false);
                      }} className="px-4 py-2 hover:bg-blue-50/50 cursor-pointer text-sm font-medium border-b border-muted/30 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] bg-blue-100 text-blue-600 px-1 py-0.5 rounded uppercase">Catalog</span>
                          <p className="text-foreground">{c.name}</p>
                          {c.brand && <span className="text-[10px] text-blue-400 font-bold bg-blue-50 px-1.5 py-0.5 rounded">@{c.brand}</span>}
                        </div>
                      </div>
                    ))}

                    {searchingCatalog && (
                      <div className="px-4 py-2 text-[9px] text-foreground/30 animate-pulse italic">Searching catalog...</div>
                    )}

                    {!ingredients.some(i => i.name.toLowerCase() === ingSearch.toLowerCase()) && !catalogSuggestions.some(c => c.name.toLowerCase() === ingSearch.toLowerCase()) && ingSearch && (
                      <div onClick={() => setShowIngSuggestions(false)} className="px-4 py-3 hover:bg-green-50 cursor-pointer transition-colors">
                        <div className="flex items-center gap-3 text-green-600">
                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center font-bold text-xs">+</div>
                          <div>
                            <p className="text-sm font-bold">Add &quot;{ingSearch}&quot; as custom</p>
                            <p className="text-[10px] opacity-70 font-medium">Will be created on save</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-foreground/40 uppercase mb-1 block">Brand (Opt)</label>
                <input placeholder="Anchor" value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-muted text-sm focus:border-primary focus:outline-none bg-white" />
              </div>
            </div>

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
              <button onClick={handleAdd} disabled={!ingSearch || form.quantity_needed <= 0}
                className="h-10 px-4 bg-foreground text-white font-bold text-xs rounded-xl disabled:opacity-50 hover:bg-black transition-colors">
                + Add
              </button>
            </div>
          </div>
        </div>

        <div className="flex-none pt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 h-12 bg-muted text-foreground/60 font-bold rounded-xl hover:bg-muted/80 transition-all">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-[2] h-12 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-70">
            {saving ? 'Saving...' : `Save Recipe${pendingRecipes.length > 0 ? ` (+${pendingRecipes.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}


