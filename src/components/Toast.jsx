import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, BadgeCheck, X } from 'lucide-react';
import './Toast.css';

export default function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }) {
  const { title, message, type = 'info', duration = 4000, icon } = toast;

  useEffect(() => {
    if (duration) {
      const timer = setTimeout(() => {
        onRemove();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onRemove]);

  const getIcon = () => {
    if (icon) return icon;
    if (title === 'Order Confirmed' || type === 'order') {
      return <BadgeCheck size={22} />;
    }
    switch (type) {
      case 'success':
        return <CheckCircle size={22} />;
      case 'error':
        return <AlertCircle size={22} />;
      case 'warning':
        return <AlertTriangle size={22} />;
      case 'info':
      default:
        return <Info size={22} />;
    }
  };

  return (
    <div className={`toast-item toast-${type}`}>
      <div className="toast-icon">{getIcon()}</div>
      <div className="toast-content">
        {title && <div className="toast-title">{title}</div>}
        <div className="toast-message">{message}</div>
      </div>
      <button className="toast-close" onClick={onRemove} aria-label="Close notification">
        <X size={16} />
      </button>
    </div>
  );
}
