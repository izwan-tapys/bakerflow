'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  is_on_shopping_list?: boolean;
}

interface ShoppingItem {
  ingredient: Ingredient;
  needed: number;
  shortfall: number;
  suggestedPacks: number;
  suggestedTotalQty: number;
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
  const [activeMainTab, setActiveMainTab] = useState<IngredientType | 'purchases' | 'shopping'>('raw');
  
  // Modal States
  const [showAdd, setShowAdd] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifSelectedIds, setNotifSelectedIds] = useState<string[]>([]);
  const [notifSelectMode, setNotifSelectMode] = useState(false);
  const notifLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [pendingAlertAction, setPendingAlertAction] = useState<any>(null);
  const [manualShoppingIds, setManualShoppingIds] = useState<string[]>([]);
  
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
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const CATEGORIES = ['Semua', 'Tepung', 'Tenusu', 'Gula', 'Lemak', 'Hiasan', 'Packaging', 'Lain-lain'];

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    setLoading(true);
    const [ingRes, ordersRes, recipesRes, purchasesRes] = await Promise.all([
      supabase.from('ingredients').select('*, is_on_shopping_list').eq('baker_id', user.id).order('name'),
      supabase.from('orders').select('product_id, quantity').eq('baker_id', user.id).in('status', ['pending', 'approved', 'production']),
      supabase.from('recipes').select('*').eq('baker_id', user.id),
      supabase.from('ingredient_purchases').select('*, ingredients(name)').eq('baker_id', user.id).order('purchased_at', { ascending: false }).limit(50)
    ]);

    const loadedIngredients = (ingRes.data || []).map(ing => ({
      ...ing,
      type: ing.type || 'raw'
    })) as Ingredient[];

    setIngredients(loadedIngredients);
    // Sync shopping list from DB (source of truth)
    const dbShoppingIds = loadedIngredients
      .filter(i => !!i.is_on_shopping_list)
      .map(i => i.id);
    
    console.log('DB Shopping IDs Loaded:', dbShoppingIds);
    setManualShoppingIds(dbShoppingIds);
    localStorage.setItem(`bf_shopping_${user.id}`, JSON.stringify(dbShoppingIds));
    
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
      const neededForOrders = requiredMap.get(ing.id) || 0;
      const buffer = ing.low_stock_threshold || 0;
      
      const isShortForOrders = neededForOrders > 0 && ing.current_stock < neededForOrders;
      const isBelowThreshold = ing.current_stock < buffer;

      if (isShortForOrders || isBelowThreshold) {
        const targetStock = Math.max(neededForOrders, buffer);
        const shortfall = targetStock - ing.current_stock;
        
        let suggestedPacks = 0;
        let suggestedTotalQty = shortfall;

        if (ing.pack_size && ing.pack_size > 0) {
          suggestedPacks = Math.ceil(shortfall / ing.pack_size);
          suggestedTotalQty = suggestedPacks * ing.pack_size;
        }

        newShoppingList.push({
          ingredient: ing,
          needed: neededForOrders,
          shortfall,
          suggestedPacks,
          suggestedTotalQty
        });
      }
    });

    setShoppingList(newShoppingList);
    setIngredients(loadedIngredients);
    // Note: We'll merge manualShoppingIds in the filtered view or here
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

  // On mount: load from localStorage immediately (fast), DB will sync via loadData
  useEffect(() => {
    const preload = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const cached = localStorage.getItem(`bf_shopping_${user.id}`);
      if (cached) setManualShoppingIds(JSON.parse(cached));
    };
    preload();
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

  const handleToggleShoppingList = async (ids: string[], status: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update local state immediately (optimistic)
    setManualShoppingIds(prev => {
      const next = status 
        ? [...new Set([...prev, ...ids])]
        : prev.filter(id => !ids.includes(id));
      localStorage.setItem(`bf_shopping_${user.id}`, JSON.stringify(next));
      return next;
    });

    // Persist to Supabase DB
    console.log(`Syncing to DB: ${status ? 'ADD' : 'REMOVE'}`, ids);
    const { error } = await supabase
      .from('ingredients')
      .update({ is_on_shopping_list: status })
      .in('id', ids);
    
    if (error) {
      console.error('Supabase Shopping List Sync Error:', error);
      alert('Failed to save to database: ' + error.message);
    } else {
      console.log('Supabase Sync Success');
    }
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

  const handleQuickRestock = async (item: ShoppingItem, customQty?: number, customPrice?: number) => {
    const qty = customQty ?? (item.suggestedTotalQty || item.shortfall);
    const totalCost = customPrice ?? (qty * item.ingredient.avg_cost_per_unit);
    
    if (qty <= 0) return;
    
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // 1. Update ingredient stock and turn off shopping flag
      const { error: ingError } = await supabase
        .from('ingredients')
        .update({ 
          current_stock: item.ingredient.current_stock + qty,
          is_on_shopping_list: false 
        })
        .eq('id', item.ingredient.id);

      if (ingError) throw ingError;

      // 2. Record purchase
      const { error: purError } = await supabase
        .from('ingredient_purchases')
        .insert({
          baker_id: user.id,
          ingredient_id: item.ingredient.id,
          quantity: qty,
          unit: item.ingredient.unit,
          total_cost: totalCost,
          purchased_at: new Date().toISOString()
        });

      if (purError) throw purError;

      // 3. Clear from local manual list
      setManualShoppingIds(prev => prev.filter(id => id !== item.ingredient.id));
      
      await loadData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
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
    if (activeMainTab === 'shopping' || activeMainTab === 'purchases') return false;
    if (i.type !== activeMainTab) return false;
    if (searchQuery && !i.name.toLowerCase().includes(searchQuery.toLowerCase()) && !(i.brand || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedCategory !== 'Semua' && i.category !== selectedCategory) return false;
    if (statusFilter === 'in_stock') return i.current_stock > i.low_stock_threshold;
    if (statusFilter === 'low_stock') return i.current_stock > 0 && i.current_stock <= i.low_stock_threshold;
    if (statusFilter === 'out_of_stock') return i.current_stock <= 0;
    if (statusFilter === 'expiring_soon') return !!i.shelf_life && i.current_stock > 0 && i.shelf_life >= 0 && i.shelf_life <= 7;
    if (statusFilter === 'expired') return !!i.shelf_life && i.current_stock > 0 && i.shelf_life < 0;
    return true;
  });

  const hasActiveFilter = !!(searchQuery || selectedCategory !== 'Semua' || statusFilter);
  const clearFilters = () => { setSearchQuery(''); setSelectedCategory('Semua'); setStatusFilter(''); };

  // IDs that are already handled (in shopping list) — exclude from alerts
  const autoShoppingIds = new Set(shoppingList.map(s => s.ingredient.id));
  const allShoppingIds = new Set([...autoShoppingIds, ...manualShoppingIds]);

  // Notification alerts — skip items already in shopping list
  const alerts = [
    ...ingredients.filter(i => i.current_stock <= 0 && !allShoppingIds.has(i.id)).map(i => ({
      id: `out_${i.id}`, type: 'out' as const,
      icon: '❌', label: i.name,
      msg: `Out of stock (${i.current_stock}${i.unit})`,
      color: 'text-red-500', bg: 'bg-red-50'
    })),
    ...ingredients.filter(i => i.current_stock > 0 && i.current_stock <= i.low_stock_threshold && !allShoppingIds.has(i.id)).map(i => ({
      id: `low_${i.id}`, type: 'low' as const,
      icon: '⚠️', label: i.name,
      msg: `Low stock — ${i.current_stock}${i.unit} left (threshold: ${i.low_stock_threshold}${i.unit})`,
      color: 'text-amber-500', bg: 'bg-amber-50'
    })),
    ...ingredients.filter(i => !!i.shelf_life && i.current_stock > 0 && (i.shelf_life as number) <= 7 && (i.shelf_life as number) >= 0 && !allShoppingIds.has(i.id)).map(i => ({
      id: `exp_${i.id}`, type: 'exp' as const,
      icon: '⏳', label: i.name,
      msg: `Expiring in ${i.shelf_life} day${(i.shelf_life as number) === 1 ? '' : 's'}`,
      color: 'text-orange-500', bg: 'bg-orange-50'
    })),
    ...ingredients.filter(i => !!i.shelf_life && i.current_stock > 0 && (i.shelf_life as number) < 0 && !allShoppingIds.has(i.id)).map(i => ({
      id: `expd_${i.id}`, type: 'expd' as const,
      icon: '🚫', label: i.name,
      msg: `Expired`,
      color: 'text-red-600', bg: 'bg-red-50',
      ingredient: i
    })),
  ].map(a => ({
    ...a,
    ingredient: ingredients.find(ing => ing.id === (a.id.split('_').slice(1).join('_'))) || (a as any).ingredient
  }));

  return (
    <div className="pb-4">
      <KitchenTabs />

      {/* Main Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Inventory</h1>
          <p className="text-foreground/50 text-sm font-medium">Manage your kitchen resources</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(v => !v)}
              className="relative w-12 h-12 flex items-center justify-center rounded-2xl border-2 border-muted bg-white hover:border-primary/30 hover:bg-primary/5 transition-all active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-foreground/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {alerts.length > 99 ? '99+' : alerts.length}
                </span>
              )}
            </button>

            {/* Notification Dropdown */}
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => { setShowNotifications(false); setNotifSelectMode(false); setNotifSelectedIds([]); }} />
                <div className="absolute right-0 top-14 w-80 bg-white rounded-2xl shadow-2xl border border-muted/50 z-40 overflow-hidden">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-muted/30 flex items-center justify-between">
                    {notifSelectMode ? (
                      <>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => notifSelectedIds.length === alerts.length
                              ? setNotifSelectedIds([])
                              : setNotifSelectedIds(alerts.map(a => a.id))
                            }
                            className="w-5 h-5 rounded border-2 border-primary flex items-center justify-center"
                          >
                            {notifSelectedIds.length === alerts.length && <span className="text-[10px] font-black text-primary">✓</span>}
                          </button>
                          <span className="font-black text-sm text-foreground">{notifSelectedIds.length} selected</span>
                        </div>
                        <button onClick={() => { setNotifSelectMode(false); setNotifSelectedIds([]); }} className="text-xs font-black text-foreground/40 uppercase tracking-widest">Cancel</button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm text-foreground">Notifications</span>
                          {alerts.length > 0 && <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{alerts.length} alerts</span>}
                        </div>
                        {alerts.length > 0 && (
                          <button
                            onClick={() => setNotifSelectMode(true)}
                            className="text-[10px] font-black text-foreground/30 hover:text-primary uppercase tracking-widest px-2 py-1 rounded-lg hover:bg-primary/5 transition-all"
                          >
                            Select
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {/* List */}
                  <div className="max-h-[320px] overflow-y-auto divide-y divide-muted/30">
                    {alerts.length === 0 ? (
                      <div className="py-10 text-center">
                        <p className="text-2xl mb-2">🎉</p>
                        <p className="text-sm font-bold text-foreground/40">All good! No alerts.</p>
                      </div>
                    ) : (
                      alerts.map(a => {
                        const isSelected = notifSelectedIds.includes(a.id);
                        return (
                          <div
                            key={a.id}
                            onPointerDown={() => {
                              if (!notifSelectMode) {
                                notifLongPressTimer.current = setTimeout(() => {
                                  setNotifSelectMode(true);
                                  setNotifSelectedIds([a.id]);
                                }, 500);
                              }
                            }}
                            onPointerUp={() => {
                              if (notifLongPressTimer.current) clearTimeout(notifLongPressTimer.current);
                              if (notifSelectMode) {
                                setNotifSelectedIds(prev =>
                                  prev.includes(a.id) ? prev.filter(i => i !== a.id) : [...prev, a.id]
                                );
                              } else {
                                setPendingAlertAction(a);
                                setShowNotifications(false);
                              }
                            }}
                            onPointerLeave={() => { if (notifLongPressTimer.current) clearTimeout(notifLongPressTimer.current); }}
                            onContextMenu={e => e.preventDefault()}
                            className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none ${
                              isSelected ? 'bg-primary/10' : 'hover:bg-muted/10 active:bg-muted/20'
                            }`}
                          >
                            {/* Checkbox (always rendered, visible on hover or in select mode) */}
                            <div className="flex-shrink-0">
                              <button
                                onPointerDown={e => e.stopPropagation()}
                                onPointerUp={e => {
                                  e.stopPropagation();
                                  if (!notifSelectMode) {
                                    setNotifSelectMode(true);
                                    setNotifSelectedIds([a.id]);
                                  } else {
                                    setNotifSelectedIds(prev =>
                                      prev.includes(a.id) ? prev.filter(i => i !== a.id) : [...prev, a.id]
                                    );
                                  }
                                }}
                                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  isSelected
                                    ? 'bg-primary border-primary opacity-100'
                                    : 'border-muted opacity-0 group-hover:opacity-100'
                                }`}
                              >
                                {isSelected && <span className="text-[9px] font-black text-white">✓</span>}
                              </button>
                            </div>

                            <div className={`w-9 h-9 rounded-xl ${a.bg} flex items-center justify-center text-base flex-shrink-0`}>
                              {a.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-black text-sm text-foreground truncate">{a.label}</p>
                              <p className={`text-xs font-semibold mt-0.5 ${a.color}`}>{a.msg}</p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  {notifSelectMode && notifSelectedIds.length > 0 ? (
                    <div className="px-3 py-3 border-t border-muted/30 flex gap-2">
                      <button
                        onClick={() => {
                          const selectedAlerts = alerts.filter((a: any) => notifSelectedIds.includes(a.id));
                          const ids = selectedAlerts.map((a: any) => a.ingredient?.id).filter(Boolean) as string[];
                          handleToggleShoppingList(ids, true);
                          setNotifSelectMode(false);
                          setNotifSelectedIds([]);
                          setShowNotifications(false);
                          setActiveMainTab('shopping');
                        }}
                        className="flex-1 h-10 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-wide flex items-center justify-center gap-1"
                      >
                        🛒 Add to Shopping
                      </button>
                      <button
                        onClick={() => { setNotifSelectMode(false); setNotifSelectedIds([]); }}
                        className="h-10 px-4 bg-muted/40 rounded-xl font-black text-[10px] uppercase text-foreground/50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    alerts.length > 0 && (
                      <div className="px-4 py-2.5 border-t border-muted/30 bg-muted/10">
                        <p className="text-[10px] font-bold text-foreground/30 text-center uppercase tracking-widest">Hold to select multiple</p>
                      </div>
                    )
                  )}
                </div>
              </>
            )}
          </div>

          {/* Add Item Button */}
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
      </div>

      {/* Main Navigation Tabs - STICKY within main scroll container */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md -mx-4 md:-mx-8 px-4 md:px-8 py-3 border-b border-muted/30 mb-4">
        <div className="flex bg-muted/30 p-1.5 rounded-[12px] border border-muted/50 overflow-x-auto no-scrollbar">
          {[
            { id: 'raw', label: 'Raw', icon: '🥣' },
            { id: 'component', label: 'Comp', icon: '🍰' },
            { id: 'supply', label: 'Supp', icon: '📦' },
            { id: 'shopping', label: 'Shop', icon: '🛒' },
            { id: 'purchases', label: 'Purch', icon: '🧾' }
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
      </div>

      {/* List Views */}
      <div className="space-y-4">
            {activeMainTab === 'purchases' ? (
              <PurchasesList purchases={purchases} />
            ) : activeMainTab === 'shopping' ? (
              <ShoppingListView 
                ordersShopping={shoppingList} 
                manualIds={manualShoppingIds}
                allIngredients={ingredients}
                onRestock={(ing: any) => { setSelectedIngredient(ing); setShowNotifications(false); }}
                onQuickConfirm={handleQuickRestock}
                onRemoveManual={(id: string) => handleToggleShoppingList([id], false)}
                onRefresh={loadData}
              />
            ) : (
              <>
                <InventoryFilterBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              categories={CATEGORIES}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              hasActiveFilter={hasActiveFilter}
              onClearFilters={clearFilters}
            />
            <IngredientsList
              ingredients={filteredIngredients}
              onSelect={setSelectedIngredient}
              loading={loading}
              onAddToShopping={(ids: string[]) => {
                handleToggleShoppingList(ids, true);
                setActiveMainTab('shopping');
              }}
              onBulkDelete={async (ids: string[]) => {
                if (!confirm(`Delete ${ids.length} item(s)?`)) return;
                await supabase.from('ingredients').delete().in('id', ids);
                loadData();
              }}
            />
          </>
        )}
      </div>

      {/* Notification Action Chooser */}
      {pendingAlertAction && (
        <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-md flex items-end justify-center sm:items-center p-4">
          <div className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                {pendingAlertAction.icon}
              </div>
              <h3 className="text-xl font-black text-foreground">{pendingAlertAction.label}</h3>
              <p className="text-sm text-foreground/40 font-medium mt-1">{pendingAlertAction.msg}</p>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => {
                  handleToggleShoppingList([pendingAlertAction.ingredient.id], true);
                  setPendingAlertAction(null);
                  setActiveMainTab('shopping');
                }}
                className="w-full h-14 bg-primary text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                🛒 ADD TO SHOPPING LIST
              </button>
              <button 
                onClick={() => {
                  setSelectedIngredient(pendingAlertAction.ingredient);
                  setPendingAlertAction(null);
                }}
                className="w-full h-14 bg-white text-foreground border-2 border-muted rounded-2xl font-black text-sm flex items-center justify-center gap-2"
              >
                ➕ RESTOCK MANUALLY
              </button>
              <button 
                onClick={() => setPendingAlertAction(null)}
                className="w-full h-12 text-foreground/30 font-black text-[10px] uppercase tracking-widest pt-2"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
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
      {/* Frozen header */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/30 border-b border-muted/50">
              <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest">Date</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest">Item</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right">Qty</th>
              <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right">Total</th>
            </tr>
          </thead>
        </table>
      </div>
      {/* Scrollable body */}
      <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
        <table className="w-full text-left border-collapse">
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

function ShoppingListView({ ordersShopping, manualIds, allIngredients, onRestock, onQuickConfirm, onRemoveManual, onRefresh }: any) {
  const [receiptData, setReceiptData] = useState<Record<string, { qty: number; price: number }>>({});
  const [scanning, setScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine orders-based shopping list with manual IDs
  const manualItems = manualIds.map((id: string) => {
    const ing = allIngredients.find((i: any) => i.id === id);
    if (!ing) return null;
    return { ingredient: ing, needed: 0, shortfall: 0, suggestedPacks: 0, suggestedTotalQty: 0, isManual: true };
  }).filter(Boolean);

  // Deduplicate: If an item is in ordersShopping, don't show it again from manualItems
  const ordersIngIds = new Set(ordersShopping.map((i: any) => i.ingredient.id));
  const uniqueManualItems = manualItems.filter((i: any) => !ordersIngIds.has(i.ingredient.id));

  const combinedList = [...ordersShopping, ...uniqueManualItems];

  // Initialize receipt data with suggested quantities
  useEffect(() => {
    const initial: Record<string, { qty: number; price: number }> = {};
    combinedList.forEach((item: any) => {
      if (!receiptData[item.ingredient.id]) {
        initial[item.ingredient.id] = { 
          qty: item.suggestedTotalQty || item.shortfall || 0, 
          price: 0 
        };
      }
    });
    if (Object.keys(initial).length > 0) {
      setReceiptData(prev => ({ ...prev, ...initial }));
    }
  }, [combinedList]);

  const updateReceipt = (id: string, field: 'qty' | 'price', val: number) => {
    setReceiptData(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: val }
    }));
  };

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        
        const res = await fetch('/api/ai/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: base64,
            shoppingList: combinedList.map((i: any) => ({ id: i.ingredient.id, name: i.ingredient.name }))
          })
        });
        
        const { data, error } = await res.json();
        if (error) throw new Error(error);

        // Map AI results to state
        const updates: Record<string, { qty: number; price: number }> = {};
        data.forEach((entry: any) => {
          if (entry.id) {
            updates[entry.id] = { qty: entry.qty, price: entry.price };
          }
        });
        
        setReceiptData(prev => ({ ...prev, ...updates }));
        alert(`AI successfully scanned ${data.length} items from receipt!`);
      };
    } catch (err: any) {
      alert('Scanning failed: ' + err.message);
    } finally {
      setScanning(false);
    }
  };

  const handleShare = (platform: 'wa' | 'tg') => {
    const listText = combinedList.map((item: any) => {
      const name = item.ingredient.name;
      const brand = item.ingredient.brand ? ` (${item.ingredient.brand})` : '';
      const qty = item.needed > 0 ? `${item.shortfall}${item.ingredient.unit}` : 'Any qty';
      return `• ${name}${brand}: ${qty}`;
    }).join('\n');

    const message = `🧁 *BAKERFLOW SHOPPING LIST*\n\n${listText}\n\nGenerated on ${new Date().toLocaleDateString()}`;
    const encoded = encodeURIComponent(message);

    if (platform === 'wa') {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    } else {
      window.open(`https://t.me/share/url?url=${encodeURIComponent('https://bakerflow.app')}&text=${encoded}`, '_blank');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl flex items-start gap-3 flex-1">
          <span className="text-xl">💡</span>
          <p className="text-[10px] font-bold text-primary/80 leading-relaxed uppercase tracking-tight">
            Auto-calculated from pending orders or added manually.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="file" 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            ref={fileInputRef} 
            onChange={handleScan}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className={`h-12 px-5 rounded-2xl border-2 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95 ${
              scanning ? 'bg-muted text-foreground/20' : 'bg-white border-primary text-primary hover:bg-primary/5'
            }`}
          >
            {scanning ? '⌛ Scanning...' : '📷 Scan Receipt'}
          </button>

          {Object.values(receiptData).some(d => d.price > 0) && (
            <button 
              onClick={async () => {
                const toConfirm = combinedList.filter((item: any) => {
                  const data = receiptData[item.ingredient.id];
                  return data && data.price > 0 && data.qty > 0;
                });
                if (!confirm(`Update inventory for ${toConfirm.length} items?`)) return;
                for (const item of toConfirm) {
                  const data = receiptData[item.ingredient.id];
                  await onQuickConfirm(item, data.qty, data.price);
                }
              }}
              className="h-12 px-6 rounded-2xl bg-green-500 text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-green-500/20 active:scale-95 animate-in zoom-in duration-200"
            >
              Update Inventory ({combinedList.filter((item: any) => receiptData[item.ingredient.id]?.price > 0).length})
            </button>
          )}
          <button 
            onClick={(e) => {
              if (onRefresh) onRefresh();
              const btn = e.currentTarget;
              const original = btn.innerHTML;
              btn.innerHTML = 'Saved! ✅';
              btn.classList.replace('bg-primary', 'bg-green-500');
              setTimeout(() => {
                btn.innerHTML = original;
                btn.classList.replace('bg-green-500', 'bg-primary');
              }, 2000);
            }}
            className="h-12 px-6 rounded-2xl bg-primary text-white font-black text-xs uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-primary/20 active:scale-95"
          >
            Save List
          </button>
          <button 
            onClick={() => handleShare('wa')}
            className="w-12 h-12 rounded-2xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center hover:bg-[#25D366] hover:text-white transition-all shadow-sm active:scale-95"
            title="Share to WhatsApp"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
          </button>
          <button 
            onClick={() => handleShare('tg')}
            className="w-12 h-12 rounded-2xl bg-[#0088cc]/10 text-[#0088cc] flex items-center justify-center hover:bg-[#0088cc] hover:text-white transition-all shadow-sm active:scale-95"
            title="Share to Telegram"
          >
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.25-5.54 3.69-.52.35-.99.53-1.41.52-.46-.01-1.35-.26-2.01-.48-.81-.27-1.45-.42-1.39-.89.03-.25.38-.51 1.07-.78 4.2-1.83 7-3.03 8.4-3.61 4-.1.17-1.63 1.21-1.63.23 0 .74.04 1.07.31.28.22.37.52.39.73.03.2.04.59 0 .91z"/></svg>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[16px] border border-muted shadow-sm overflow-hidden flex flex-col max-h-[70vh] relative">
        {/* Scanning Overlay */}
        {scanning && (
          <div className="absolute inset-0 z-[100] bg-white/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-4 relative">
              <div className="absolute inset-0 bg-primary/20 rounded-3xl animate-ping" />
              <svg viewBox="0 0 24 24" className="w-10 h-10 text-primary animate-bounce">
                <path fill="currentColor" d="M3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2zm16 14H5V5h14v14zM7 10h10v2H7zm0-3h10v2H7zm0 6h7v2H7z"/>
              </svg>
            </div>
            <h3 className="text-lg font-black text-foreground tracking-tight">AI is reading your receipt</h3>
            <p className="text-sm text-foreground/40 font-medium">Please wait a moment...</p>
            <div className="mt-6 flex gap-1">
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
              <span className="w-2 h-2 bg-primary rounded-full animate-bounce" />
            </div>
          </div>
        )}

        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
              <tr className="bg-muted/30">
                <th className="pl-4 py-4 w-12 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-center">No</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest">Item To Buy</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right w-24">Suggested</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest w-24 text-center">Qty Bought</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest w-32 text-center">Total Price</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted/50">
              {combinedList.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-20 text-center text-foreground/30 font-bold italic text-sm">Your shopping list is empty.</td></tr>
              ) : (
                combinedList.map((item: any, idx: number) => {
                  const data = receiptData[item.ingredient.id] || { qty: 0, price: 0 };
                  const isReady = data.price > 0 && data.qty > 0;
                  
                  return (
                  <tr key={item.ingredient.id + idx} className={`group transition-colors ${isReady ? 'bg-green-50/50' : ''}`}>
                    <td className="pl-4 py-5 w-12 text-center font-black text-[10px] text-foreground/30">{idx + 1}</td>
                    <td className="px-4 py-5 min-w-[140px]">
                      <p className="font-bold text-sm text-foreground">{item.ingredient.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-foreground/30 font-bold uppercase tracking-tight">{item.ingredient.brand || 'No Brand'}</p>
                        <span className="w-1 h-1 bg-foreground/10 rounded-full" />
                        <p className="text-[9px] font-black text-amber-600/60 uppercase">Stock: {item.ingredient.current_stock}{item.ingredient.unit}</p>
                      </div>
                    </td>
                    <td className="px-4 py-5 text-right w-24">
                      <p className="text-xs font-black text-foreground/60 leading-tight">
                        {item.suggestedPacks > 0 
                          ? `${item.suggestedPacks} ${item.ingredient.pack_unit || 'pk'}`
                          : `${item.shortfall}${item.ingredient.unit}`
                        }
                      </p>
                      <p className="text-[9px] font-bold text-foreground/30 uppercase mt-0.5">
                        ~{item.suggestedTotalQty || item.shortfall}{item.ingredient.unit}
                      </p>
                    </td>
                    <td className="px-4 py-5 w-24">
                      <div className="relative">
                        <input 
                          type="number"
                          value={data.qty}
                          onChange={e => updateReceipt(item.ingredient.id, 'qty', Number(e.target.value))}
                          className="w-full h-10 px-2 rounded-lg border-2 border-muted focus:border-primary outline-none font-bold text-sm text-center"
                        />
                        <span className="absolute -right-1 -top-2 bg-muted/80 px-1 rounded text-[8px] font-black text-foreground/40 uppercase">{item.ingredient.unit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-5 w-32">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-foreground/30">RM</span>
                        <input 
                          type="number"
                          placeholder="0.00"
                          value={data.price || ''}
                          onChange={e => updateReceipt(item.ingredient.id, 'price', Number(e.target.value))}
                          className="w-full h-10 pl-8 pr-2 rounded-lg border-2 border-muted focus:border-green-500 outline-none font-bold text-sm text-green-600"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-5 text-center w-24">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          disabled={!isReady}
                          onClick={() => onQuickConfirm(item, data.qty, data.price)}
                          className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-sm ${
                            isReady ? 'bg-green-500 text-white shadow-green-500/20' : 'bg-muted text-foreground/20 cursor-not-allowed'
                          }`}
                        >
                          Confirm
                        </button>
                        {item.isManual && (
                          <button 
                            onClick={() => onRemoveManual(item.ingredient.id)}
                            className="w-8 h-8 rounded-lg text-foreground/10 hover:text-red-400 transition-all text-xl"
                          >
                            ×
                          </button>
                        )}
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
    </div>
  );
}

function InventoryFilterBar({ searchQuery, onSearchChange, selectedCategory, onCategoryChange, categories, statusFilter, onStatusChange, hasActiveFilter, onClearFilters }: any) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const STATUS_FILTERS = [
    { id: 'in_stock',      label: 'In Stock',      icon: '✅' },
    { id: 'low_stock',     label: 'Low Stock',     icon: '⚠️' },
    { id: 'out_of_stock',  label: 'Out of Stock',  icon: '❌' },
    { id: 'expiring_soon', label: 'Expiring Soon', icon: '⏳' },
    { id: 'expired',       label: 'Expired',       icon: '🚫' },
  ];

  return (
    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
      {/* Search */}
      <div className={`relative flex-shrink-0 transition-all duration-300 ${isSearchExpanded || searchQuery ? 'w-48' : 'w-10'}`}>
        {isSearchExpanded || searchQuery ? (
          <>
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/30 text-sm pointer-events-none">🔍</span>
            <input
              autoFocus
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              onBlur={() => { if (!searchQuery) setIsSearchExpanded(false); }}
              className="w-full h-10 pl-8 pr-7 rounded-xl border-2 border-muted bg-white text-sm font-medium focus:border-primary outline-none transition-colors placeholder:text-foreground/30"
            />
            <button 
              onClick={() => { onSearchChange(''); setIsSearchExpanded(false); }} 
              className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/30 hover:text-foreground text-lg leading-none"
            >
              ×
            </button>
          </>
        ) : (
          <button 
            onClick={() => setIsSearchExpanded(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl border-2 border-muted bg-white text-foreground/50 hover:border-primary/40 hover:text-primary transition-all"
          >
            🔍
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-muted flex-shrink-0" />

      {/* Category Dropdown */}
      <select
        value={selectedCategory}
        onChange={e => onCategoryChange(e.target.value)}
        className="h-10 px-3 rounded-xl border-2 border-muted bg-white text-[10px] font-black focus:border-primary outline-none transition-colors text-foreground/60 flex-shrink-0"
      >
        {categories.map((c: string) => <option key={c} value={c}>{c === 'Semua' ? 'All Categories' : c}</option>)}
      </select>

      {/* Divider */}
      <div className="h-6 w-px bg-muted flex-shrink-0" />

      {/* Status Buttons */}
      {STATUS_FILTERS.map(f => (
        <button
          key={f.id}
          onClick={() => onStatusChange(statusFilter === f.id ? '' : f.id)}
          className={`flex items-center gap-1 px-3 h-10 rounded-xl text-[10px] font-black uppercase tracking-wide whitespace-nowrap border-2 transition-all flex-shrink-0 ${
            statusFilter === f.id
              ? 'bg-primary border-primary text-white shadow-md shadow-primary/20'
              : 'bg-white border-muted text-foreground/40 hover:border-primary/40 hover:text-foreground/60'
          }`}
        >
          <span>{f.icon}</span>
          <span>{f.label}</span>
        </button>
      ))}

      {/* Clear */}
      {hasActiveFilter && (
        <button
          onClick={onClearFilters}
          className="flex items-center gap-1 px-3 h-10 rounded-xl text-[10px] font-black uppercase tracking-wide whitespace-nowrap border-2 border-red-200 bg-red-50 text-red-400 hover:bg-red-100 transition-all flex-shrink-0"
        >
          <span>✕</span>
          <span>Clear</span>
        </button>
      )}
    </div>
  );
}

function IngredientsList({ ingredients, onSelect, loading, onAddToShopping, onBulkDelete }: any) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds([]); };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const startLongPress = (id: string) => {
    longPressTimer.current = setTimeout(() => {
      setSelectMode(true);
      setSelectedIds([id]);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const allSelected = selectedIds.length === ingredients.length && ingredients.length > 0;

  return (
    <div className="relative">
      {/* Select mode header bar — shown in select mode */}
      {selectMode && (
        <div className="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 bg-primary text-white rounded-t-[16px] shadow-md overflow-x-auto no-scrollbar">
          {/* Select all checkbox + count */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => allSelected ? setSelectedIds([]) : setSelectedIds(ingredients.map((i: Ingredient) => i.id))}
              className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                allSelected ? 'bg-white border-white text-primary' : 'border-white/60'
              }`}
            >
              {allSelected && <span className="text-[10px] font-black text-primary">✓</span>}
            </button>
            <span className="font-black text-sm whitespace-nowrap">{selectedIds.length} selected</span>
          </div>

          {/* Actions — only shown when something is selected */}
          {selectedIds.length > 0 && (
            <>
              <div className="h-4 w-px bg-white/20 flex-shrink-0 mx-1" />
              <button
                onClick={() => { onAddToShopping(selectedIds); exitSelectMode(); }}
                className="flex items-center gap-1 px-3 h-8 bg-white/15 hover:bg-white/25 rounded-xl text-[10px] font-black uppercase tracking-wide whitespace-nowrap transition-all flex-shrink-0"
              >
                🛒 Shopping
              </button>
              <button
                onClick={() => { onBulkDelete(selectedIds); exitSelectMode(); }}
                className="flex items-center gap-1 px-3 h-8 bg-red-400/60 hover:bg-red-400/80 rounded-xl text-[10px] font-black uppercase tracking-wide whitespace-nowrap transition-all flex-shrink-0"
              >
                🗑 Delete
              </button>
            </>
          )}

          {/* Spacer + Cancel */}
          <div className="flex-1" />
          <button onClick={exitSelectMode} className="text-white/70 font-black text-xs uppercase tracking-widest whitespace-nowrap flex-shrink-0">Cancel</button>
        </div>
      )}

      {/* "Select" button shown when NOT in select mode — for desktop users */}
      {!selectMode && ingredients.length > 0 && (
        <div className="flex justify-end mb-1">
          <button
            onClick={() => setSelectMode(true)}
            className="text-[10px] font-black text-foreground/30 hover:text-primary uppercase tracking-widest px-2 py-1 rounded-lg hover:bg-primary/5 transition-all"
          >
            Select
          </button>
        </div>
      )}

      <div className="bg-white rounded-[16px] border border-muted overflow-hidden shadow-sm">
        {/* Frozen header */}
        <div className="overflow-x-auto border-b border-muted/50">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/30">
                {/* Checkbox column — always reserve space, header shows select-all in select mode */}
                <th className="pl-4 pr-1 py-4 w-10">
                  {selectMode && (
                    <button
                      onClick={() => allSelected ? setSelectedIds([]) : setSelectedIds(ingredients.map((i: Ingredient) => i.id))}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        allSelected ? 'bg-primary border-primary' : 'border-muted'
                      }`}
                    >
                      {allSelected && <span className="text-[9px] font-black text-white">✓</span>}
                    </button>
                  )}
                </th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest">Item</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right">Inventory</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-foreground/40 tracking-widest text-right">Avg Cost</th>
                <th className="px-6 py-4 w-10" />
              </tr>
            </thead>
          </table>
        </div>

        {/* Scrollable body */}
        <div className="overflow-x-auto overflow-y-auto max-h-[60vh]">
          <table className="w-full text-left border-collapse">
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
                <tr><td colSpan={selectMode ? 5 : 4} className="px-6 py-20 text-center text-foreground/30 font-bold italic text-sm">No items found.</td></tr>
              ) : (
                ingredients.map((ing: Ingredient) => {
                  const isSelected = selectedIds.includes(ing.id);
                  return (
                    <tr
                      key={ing.id}
                      onPointerDown={() => { if (!selectMode) startLongPress(ing.id); }}
                      onPointerUp={() => {
                        cancelLongPress();
                        if (selectMode) toggleSelect(ing.id);
                        else onSelect(ing);
                      }}
                      onPointerLeave={cancelLongPress}
                      onContextMenu={e => e.preventDefault()}
                      className={`group cursor-pointer transition-colors select-none ${
                        isSelected
                          ? 'bg-primary/10'
                          : 'hover:bg-primary/[0.02] active:bg-primary/[0.05]'
                      }`}
                    >
                      {/* Checkbox column — always rendered, visible on hover or in select mode */}
                      <td className="pl-4 pr-1 py-5 w-10">
                        <button
                          onPointerDown={e => e.stopPropagation()}
                          onPointerUp={e => {
                            e.stopPropagation();
                            if (!selectMode) {
                              setSelectMode(true);
                              setSelectedIds([ing.id]);
                            } else {
                              toggleSelect(ing.id);
                            }
                          }}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-primary border-primary opacity-100'
                              : 'border-muted opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isSelected && <span className="text-[9px] font-black text-white">✓</span>}
                        </button>
                      </td>
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
                      <td className="px-6 py-5 text-center text-foreground/20">{!selectMode && '›'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
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
        <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em] border-b-2 border-primary/10 pb-2">Inventory Info</p>
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
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:mx-4 rounded-t-[24px] sm:rounded-[24px] p-8 shadow-2xl flex flex-col overflow-hidden border border-white/20" style={{height: 'min(90vh, 700px)'}}>
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
    <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:mx-4 rounded-t-[24px] sm:rounded-[24px] p-8 shadow-2xl flex flex-col overflow-hidden border border-white/20" style={{height: 'min(90vh, 700px)'}}>
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
