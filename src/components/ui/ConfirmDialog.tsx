'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, HelpCircle, X, ChevronRight } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'warning' | 'info' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Yes, Proceed',
  cancelText = 'Cancel',
  type = 'info',
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  
  const getIcon = () => {
    switch (type) {
      case 'danger':
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-red-500" />;
      default:
        return <HelpCircle className="w-6 h-6 text-primary" />;
    }
  };

  const getConfirmColor = () => {
    switch (type) {
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 hover:shadow-red-200';
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 hover:shadow-amber-200';
      default:
        return 'bg-primary hover:bg-primary/90 hover:shadow-primary/20';
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-background/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 15 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 15 }}
            transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
            className="relative w-full max-w-sm bg-card border border-muted/60 rounded-2xl p-6 shadow-2xl overflow-hidden z-10"
          >
            {/* Header / Icon */}
            <div className="flex items-start gap-4">
              <div className="p-3 bg-muted/40 rounded-xl border border-muted/50 flex-none">
                {getIcon()}
              </div>
              <div className="space-y-1.5 flex-1 pr-6">
                <h3 className="font-extrabold text-foreground text-base tracking-tight leading-none">{title}</h3>
                <p className="text-xs text-foreground/50 leading-relaxed font-semibold">{message}</p>
              </div>
              
              {/* Close Button */}
              <button 
                onClick={onCancel}
                className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted text-foreground/40 hover:text-foreground/80 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={onCancel}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-black bg-muted hover:bg-muted/80 text-foreground/70 active:scale-95 transition-all uppercase tracking-widest border border-muted/20"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-black text-white active:scale-95 transition-all uppercase tracking-widest shadow-lg flex items-center justify-center gap-1.5 ${getConfirmColor()}`}
              >
                {confirmText} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
