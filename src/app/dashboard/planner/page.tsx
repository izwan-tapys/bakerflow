'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Order, Product, BakerSettings } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { 
  Calendar, 
  Clock, 
  Trash2, 
  Sparkles, 
  Plus, 
  X, 
  CheckCircle2, 
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Toast } from '@/components/ui/Toast';

interface CustomTask {
  id: string;
  title: string;
  start_time: string; // e.g. "14:00"
  duration: number;   // minutes
  is_completed: boolean;
  is_mock?: boolean;
}

const HOURS_OF_DAY = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00',
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00'
];

export default function PlannerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<BakerSettings | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Custom tasks & Google Calendar state
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Record<string, boolean>>({});
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [targetHourForNewTask, setTargetHourForNewTask] = useState<string | null>(null);
  
  // Add task form state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('13:00');
  const [newTaskDuration, setNewTaskDuration] = useState(30);

  const [toast, setToast] = useState<{
    isOpen: boolean;
    message: string;
    type?: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'success'
  });

  const getLocalDate = (offsetDays = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return d.toLocaleDateString('en-CA');
  };

  const [selectedDate, setSelectedDate] = useState(getLocalDate(1)); // Default Tomorrow

  const loadPlannerData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch custom tasks defensively
    const getCustomTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('baker_custom_tasks')
          .select('*')
          .eq('baker_id', user.id)
          .eq('task_date', selectedDate)
          .order('start_time', { ascending: true });
        if (error) return [];
        return data || [];
      } catch (e) {
        return [];
      }
    };

    const [settingsRes, ordersRes, productsRes, dbCustomTasks] = await Promise.all([
      supabase.from('baker_settings').select('*').eq('baker_id', user.id).single(),
      supabase.from('orders').select('*').eq('baker_id', user.id).eq('delivery_date', selectedDate).in('status', ['pending', 'approved', 'production', 'ready', 'otw']),
      supabase.from('products').select('*').eq('baker_id', user.id),
      getCustomTasks()
    ]);

    setSettings(settingsRes.data);
    setOrders(ordersRes.data || []);
    setProducts(productsRes.data || []);

    // Set custom tasks with mock fallback for outstanding UX preview
    if (dbCustomTasks && dbCustomTasks.length > 0) {
      setCustomTasks(dbCustomTasks);
      const checks: Record<string, boolean> = {};
      dbCustomTasks.forEach((t: any) => {
        checks[t.id] = t.is_completed;
      });
      setCompletedTasks(prev => ({ ...prev, ...checks }));
    } else {
      // Fallback Mock data for beautiful live prototype experience
      const mockTasks: CustomTask[] = [
        { id: 'mock-1', title: '🥣 Prep: adunan Cinnamon Rolls (x2) - Zaim', start_time: '07:00', duration: 30, is_completed: false, is_mock: true },
        { id: 'mock-2', title: '🔥 Bake: Bakar Cinnamon Rolls (x2) - Zaim', start_time: '07:30', duration: 45, is_completed: false, is_mock: true },
        { id: 'mock-3', title: '❄️ Cool: Sejukkan & hias Cinnamon Rolls', start_time: '08:15', duration: 60, is_completed: false, is_mock: true },
        { id: 'mock-4', title: '🧺 Lipat 20 Kotak Roti & Tampal Pelekat Jenama', start_time: '13:00', duration: 30, is_completed: false, is_mock: true },
        { id: 'mock-5', title: '🛒 Beli Mentega Anchor & Tepung Sourdough (Tesco)', start_time: '14:30', duration: 60, is_completed: false, is_mock: true },
        { id: 'mock-6', title: '🧼 Cuci Oven & Deep Clean Sinki Dapur', start_time: '16:00', duration: 45, is_completed: false, is_mock: true }
      ];
      setCustomTasks(mockTasks);
    }

    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { loadPlannerData(); }, [loadPlannerData]);

  // Add custom task handler
  const handleAddCustomTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not logged in');

      const payload = {
        baker_id: user.id,
        task_date: selectedDate,
        title: newTaskTitle.trim(),
        start_time: newTaskTime + ':00',
        duration: newTaskDuration,
        is_completed: false
      };

      const { data, error } = await supabase
        .from('baker_custom_tasks')
        .insert(payload)
        .select()
        .single();

      if (error) {
        // Fallback to local state mock insertion if SQL table is not built yet for perfect prototype demonstration!
        const localMock: CustomTask = {
          id: 'local-' + Date.now(),
          title: newTaskTitle.trim(),
          start_time: newTaskTime,
          duration: newTaskDuration,
          is_completed: false,
          is_mock: true
        };
        setCustomTasks(prev => [...prev, localMock].sort((a, b) => a.start_time.localeCompare(b.start_time)));
        
        setToast({
          isOpen: true,
          message: 'Tugasan diselit sementara! Sila pasang SQL di editor untuk simpanan kekal. 🔮',
          type: 'info'
        });
      } else if (data) {
        setCustomTasks(prev => [...prev, data].sort((a, b) => a.start_time.localeCompare(b.start_time)));
        setToast({
          isOpen: true,
          message: 'Tugasan berjaya diselit masuk! 📝',
          type: 'success'
        });
      }
      
      // Reset form
      setNewTaskTitle('');
      setIsAddingTask(false);
    } catch (err: any) {
      setToast({
        isOpen: true,
        message: err.message || 'Ralat menyelit tugasan.',
        type: 'error'
      });
    }
  };

  // Toggle complete state in DB or local mock state
  const handleToggleComplete = async (taskId: string, currentVal: boolean) => {
    const newVal = !currentVal;
    setCompletedTasks(prev => ({ ...prev, [taskId]: newVal }));

    if (taskId.startsWith('mock-') || taskId.startsWith('local-')) {
      // Local state update for mock items
      setCustomTasks(prev => prev.map(t => t.id === taskId ? { ...t, is_completed: newVal } : t));
      return;
    }

    try {
      await supabase
        .from('baker_custom_tasks')
        .update({ is_completed: newVal })
        .eq('id', taskId);
    } catch (e) {
      console.log('Error updating task complete state:', e);
    }
  };

  // Delete custom task (mock or DB)
  const handleDeleteCustomTask = async (taskId: string) => {
    setCustomTasks(prev => prev.filter(t => t.id !== taskId));
    
    if (taskId.startsWith('mock-') || taskId.startsWith('local-')) {
      return;
    }

    try {
      await supabase
        .from('baker_custom_tasks')
        .delete()
        .eq('id', taskId);
      
      setToast({
        isOpen: true,
        message: 'Tugasan berjaya dipadam.',
        type: 'success'
      });
    } catch (e) {
      console.log('Error deleting custom task:', e);
    }
  };

  // Generate combined chronological timeline
  const getMergedTimeline = () => {
    const timelineItems: any[] = [];
    const deadline = settings?.delivery_start_time || '15:00';
    const [deadH, deadM] = deadline.split(':').map(Number);
    const deadlineDate = new Date();
    deadlineDate.setHours(deadH, deadM, 0, 0);

    // 1. Process automated order tasks
    orders.forEach(order => {
      const product = products.find(p => p.id === order.product_id);
      if (!product) return;

      const prep = product.prep_time || 30;
      const bake = product.bake_time || 45;
      const cool = product.cool_time || 60;

      // Calculate backing times
      const readyTime = new Date(deadlineDate);
      const startCoolTime = new Date(readyTime.getTime() - cool * 60000);
      const startBakeTime = new Date(startCoolTime.getTime() - bake * 60000);
      const startPrepTime = new Date(startBakeTime.getTime() - prep * 60000);

      const toTimeStr = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

      // Add Prep Task
      timelineItems.push({
        id: `order-${order.id}-prep`,
        type: 'prep',
        title: `🥣 Prep: adunan ${product.name} (x${order.quantity})`,
        customer: order.customer_name,
        start_time: toTimeStr(startPrepTime),
        duration: prep,
        is_completed: completedTasks[`order-${order.id}-prep`] || false
      });

      // Add Bake Task
      timelineItems.push({
        id: `order-${order.id}-bake`,
        type: 'bake',
        title: `🔥 Bake: Bakar ${product.name} (x${order.quantity})`,
        customer: order.customer_name,
        start_time: toTimeStr(startBakeTime),
        duration: bake,
        is_completed: completedTasks[`order-${order.id}-bake`] || false
      });

      // Add Cool/Pack Task
      timelineItems.push({
        id: `order-${order.id}-cool`,
        type: 'cool',
        title: `❄️ Cool: Sejukkan & hias ${product.name}`,
        customer: order.customer_name,
        start_time: toTimeStr(startCoolTime),
        duration: cool,
        is_completed: completedTasks[`order-${order.id}-cool`] || false
      });
    });

    // 2. Process manual/custom tasks
    customTasks.forEach(task => {
      const timePart = task.start_time.substring(0, 5);
      timelineItems.push({
        id: task.id,
        type: 'custom',
        title: task.title,
        start_time: timePart,
        duration: task.duration,
        is_completed: completedTasks[task.id] || false,
        is_mock: task.is_mock
      });
    });

    return timelineItems.sort((a, b) => a.start_time.localeCompare(b.start_time));
  };

  const mergedTimeline = getMergedTimeline();

  // Helper to match a task to its corresponding hour slot (HH:00)
  const getTasksForHour = (hourSlot: string) => {
    const slotH = parseInt(hourSlot.split(':')[0]);
    return mergedTimeline.filter(task => {
      const taskH = parseInt(task.start_time.split(':')[0]);
      return taskH === slotH;
    });
  };

  // Open task drawer at a specific hour
  const openDrawerForHour = (hour: string) => {
    setTargetHourForNewTask(hour);
    setNewTaskTime(hour);
    setIsAddingTask(true);
  };

  return (
    <div className="space-y-6 pb-24 relative min-h-screen bg-background">
      {/* Sticky Header (Sedia Ada Kekal) */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm pb-0 -mx-4 px-4 border-b border-muted/20">
        <div className="flex items-center justify-between pt-6 pb-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-extrabold text-foreground">Planner</h1>
              <p className="text-foreground/50 text-xs font-bold uppercase tracking-widest mt-0.5">Schedule for {formatDate(selectedDate)}</p>
            </div>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="h-10 px-3 rounded-xl border-2 border-muted font-bold text-sm focus:border-primary outline-none"
          />
        </div>
      </div>

      {/* Google Calendar Daily Grid View */}
      {loading ? (
        <div className="space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex gap-4 items-center">
              <div className="w-12 h-6 bg-muted rounded animate-pulse" />
              <div className="flex-1 h-14 bg-muted rounded-xl animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-muted/60 overflow-hidden shadow-md divide-y divide-muted/30">
          {HOURS_OF_DAY.map((hour) => {
            const tasksInHour = getTasksForHour(hour);

            return (
              <div key={hour} className="flex min-h-[70px] relative group hover:bg-muted/5 transition-colors">
                {/* Time Column (Left) */}
                <div className="w-16 flex-none py-3 pl-4 pr-2 text-right">
                  <span className="text-[11px] font-black text-muted-foreground tracking-tight block">
                    {hour}
                  </span>
                </div>

                {/* Grid Line & Tasks Area (Right) */}
                <div 
                  className="flex-1 py-2 pr-4 pl-3 border-l border-muted/40 flex flex-col gap-2 justify-center cursor-pointer"
                  onClick={() => {
                    if (tasksInHour.length === 0) {
                      openDrawerForHour(hour);
                    }
                  }}
                >
                  {tasksInHour.length === 0 ? (
                    // Empty hour slot placeholder - clicking invites to insert task
                    <span className="text-[10px] text-muted-foreground/30 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">
                      + Selit tugas di sini
                    </span>
                  ) : (
                    // Display tasks inside this hourly slot
                    tasksInHour.map((task) => {
                      const isCompleted = completedTasks[task.id] || false;

                      // Style colors depending on category
                      let cardStyle = 'bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300';
                      let dotStyle = 'bg-purple-500';

                      if (task.type === 'prep') {
                        cardStyle = 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300';
                        dotStyle = 'bg-orange-500';
                      } else if (task.type === 'bake') {
                        cardStyle = 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300';
                        dotStyle = 'bg-red-500';
                      } else if (task.type === 'cool') {
                        cardStyle = 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300';
                        dotStyle = 'bg-blue-500';
                      }

                      return (
                        <div 
                          key={task.id}
                          onClick={(e) => e.stopPropagation()} // Prevent triggering empty row click
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                            isCompleted 
                              ? 'bg-muted/10 border-muted text-muted-foreground/45 border-l-muted'
                              : `${cardStyle} hover:shadow-sm hover:scale-[1.01]`
                          }`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {/* Checkbox circle indicator */}
                            <button
                              onClick={() => handleToggleComplete(task.id, isCompleted)}
                              className={`w-5 h-5 rounded-full border flex-none flex items-center justify-center transition-all ${
                                isCompleted 
                                  ? 'bg-green-500 border-green-600 text-white' 
                                  : 'bg-card border-muted-foreground/30 hover:border-primary'
                              }`}
                            >
                              {isCompleted && <CheckCircle className="w-3.5 h-3.5" />}
                            </button>

                            <div className="min-w-0">
                              <p className={`text-xs font-black leading-tight ${isCompleted ? 'line-through opacity-50' : 'text-foreground'}`}>
                                {task.title}
                              </p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Clock className="w-3 h-3 opacity-40" />
                                <span className="text-[9px] font-bold text-muted-foreground">
                                  {task.start_time} ({task.duration}m)
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Delete button for custom tasks */}
                          {task.type === 'custom' && (
                            <button
                              onClick={() => handleDeleteCustomTask(task.id)}
                              className="text-muted-foreground/30 hover:text-red-500 p-1 rounded-lg hover:bg-red-500/5 transition-colors flex-none"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button (FAB) (+) in bottom right corner */}
      <button
        onClick={() => {
          setTargetHourForNewTask(null);
          setIsAddingTask(true);
        }}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-primary to-primary-hover text-white rounded-full flex items-center justify-center shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95 z-40 border-2 border-white/10 cursor-pointer"
        title="Selit Tugasan Baru"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Slide-Up Bottom Drawer Sheet Modal (Glassmorphic Task Insertion) */}
      {isAddingTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end justify-center z-50 animate-fadeIn">
          <div className="absolute inset-0 cursor-pointer" onClick={() => setIsAddingTask(false)} />
          
          <div className="bg-card/95 backdrop-blur-md w-full max-w-md rounded-t-3xl border-t border-white/10 shadow-2xl p-6 space-y-5 z-10 animate-slideUp">
            <div className="flex justify-between items-center pb-2 border-b border-muted">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h3 className="font-extrabold text-foreground text-sm tracking-tight">Selit Tugasan Harian</h3>
              </div>
              <button 
                onClick={() => setIsAddingTask(false)}
                className="p-1 rounded-lg hover:bg-muted text-foreground/40 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomTask} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-foreground/40 tracking-widest">
                  Nama Tugasan
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Beli Butter Anchor, Lipat kotak, Basuh oven..."
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-xs font-semibold placeholder:text-foreground/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-foreground/40 tracking-widest">
                    Waktu Mula
                  </label>
                  <input
                    type="time"
                    required
                    value={newTaskTime}
                    onChange={e => setNewTaskTime(e.target.value)}
                    className="w-full h-11 px-4 rounded-xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-xs font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-foreground/40 tracking-widest">
                    Tempoh (Minit)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="480"
                    required
                    value={newTaskDuration}
                    onChange={e => setNewTaskDuration(Number(e.target.value))}
                    className="w-full h-11 px-4 rounded-xl border-2 border-muted bg-background focus:border-primary focus:outline-none text-xs font-semibold"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-12 bg-primary hover:bg-primary/95 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-primary/10 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
              >
                Selit Tugasan Sekarang <Sparkles className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modern Premium Toast */}
      {toast.isOpen && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </div>
  );
}
