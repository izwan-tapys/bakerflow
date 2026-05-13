'use client';

import { useState } from 'react';

interface Step {
  title: string;
  description: string;
  icon: string;
}

const steps: Step[] = [
  { title: 'Shop Identity', description: 'Name your bakery', icon: '🏪' },
  { title: 'Your Location', description: 'Set your base address', icon: '📍' },
  { title: 'Capacity', description: 'How many orders per day?', icon: '📦' },
  { title: 'Delivery Zones', description: 'Set your delivery pricing', icon: '🚗' },
  { title: 'Payment', description: 'Connect your payment', icon: '💳' },
];

interface StepIndicatorProps {
  currentStep: number;
}

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-between w-full px-2 mb-8">
      {steps.map((step, index) => (
        <div key={index} className="flex flex-col items-center flex-1">
          <div className="flex items-center w-full">
            {/* Line before */}
            {index > 0 && (
              <div className={`h-0.5 flex-1 transition-all duration-500 ${
                index <= currentStep ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
            {/* Circle */}
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
              index < currentStep
                ? 'bg-primary text-white shadow-lg shadow-primary/30'
                : index === currentStep
                ? 'bg-primary text-white shadow-xl shadow-primary/40 scale-110'
                : 'bg-muted text-foreground/40'
            }`}>
              {index < currentStep ? '✓' : step.icon}
            </div>
            {/* Line after */}
            {index < steps.length - 1 && (
              <div className={`h-0.5 flex-1 transition-all duration-500 ${
                index < currentStep ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </div>
          {/* Label - only show for current */}
          {index === currentStep && (
            <div className="mt-2 text-center">
              <p className="text-xs font-bold text-primary">{step.title}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function TotalSteps() {
  return steps.length;
}
