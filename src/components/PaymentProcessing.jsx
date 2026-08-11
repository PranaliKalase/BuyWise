import React, { useState, useEffect } from 'react';
import { Check, Loader2, Circle } from 'lucide-react';
import './PaymentProcessing.css';

const STEPS = [
  'Initializing Transaction',
  'Verifying Payment Method',
  'Encrypting Payment Data',
  'Connecting to Payment Gateway',
  'Confirming Transaction',
  'Finalizing Payment'
];

export default function PaymentProcessing({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // 6 steps distributed over ~3.2 seconds
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < STEPS.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 500);
          return prev;
        }
      });
    }, 550);

    return () => clearInterval(interval);
  }, [onComplete]);

  const progressPercent = Math.round(((currentStep + 1) / STEPS.length) * 100);

  return (
    <div className="processing-overlay">
      <div className="processing-card">
        <div className="processing-header">
          <div className="processing-spinner" />
          <h2 className="processing-title">Processing Payment</h2>
          <p className="processing-subtitle">Please do not close this window or press back</p>
        </div>

        <div className="checklist-container">
          {STEPS.map((step, index) => {
            const isCompleted = index < currentStep;
            const isActive = index === currentStep;

            return (
              <div
                key={index}
                className={`checklist-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
              >
                <div className="step-icon-wrap">
                  {isCompleted ? (
                    <Check size={14} strokeWidth={3} />
                  ) : isActive ? (
                    <Loader2 size={14} className="spin-icon" />
                  ) : (
                    <Circle size={10} style={{ opacity: 0.3 }} />
                  )}
                </div>
                <span>{step}</span>
              </div>
            );
          })}
        </div>

        <div className="processing-progress-bar">
          <div
            className="processing-progress-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
