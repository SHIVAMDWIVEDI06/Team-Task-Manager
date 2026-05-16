import toast from 'react-hot-toast';

/**
 * Toast notification utilities with consistent styling
 */

// Default toast options
const defaultOptions = {
  duration: 4000,
  position: 'top-right',
  style: {
    borderRadius: '12px',
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: '500',
  },
};

// Success toast
export const showSuccess = (message, options = {}) => {
  return toast.success(message, {
    ...defaultOptions,
    ...options,
    style: {
      ...defaultOptions.style,
      background: '#10b981',
      color: '#fff',
      ...options.style,
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#10b981',
    },
  });
};

// Error toast
export const showError = (message, options = {}) => {
  return toast.error(message, {
    ...defaultOptions,
    duration: 5000, // Errors stay longer
    ...options,
    style: {
      ...defaultOptions.style,
      background: '#ef4444',
      color: '#fff',
      ...options.style,
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#ef4444',
    },
  });
};

// Info toast
export const showInfo = (message, options = {}) => {
  return toast(message, {
    ...defaultOptions,
    ...options,
    style: {
      ...defaultOptions.style,
      background: '#3b82f6',
      color: '#fff',
      ...options.style,
    },
    icon: 'ℹ️',
  });
};

// Warning toast
export const showWarning = (message, options = {}) => {
  return toast(message, {
    ...defaultOptions,
    ...options,
    style: {
      ...defaultOptions.style,
      background: '#f59e0b',
      color: '#fff',
      ...options.style,
    },
    icon: '⚠️',
  });
};

// Loading toast
export const showLoading = (message, options = {}) => {
  return toast.loading(message, {
    ...defaultOptions,
    ...options,
    style: {
      ...defaultOptions.style,
      background: '#6366f1',
      color: '#fff',
      ...options.style,
    },
  });
};

// Promise toast (for async operations)
export const showPromise = (promise, messages, options = {}) => {
  return toast.promise(
    promise,
    {
      loading: messages.loading || 'Loading...',
      success: messages.success || 'Success!',
      error: messages.error || 'Error occurred',
    },
    {
      ...defaultOptions,
      ...options,
    }
  );
};

// Dismiss a specific toast
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

// Dismiss all toasts
export const dismissAllToasts = () => {
  toast.dismiss();
};

// Custom toast with custom styling
export const showCustom = (message, options = {}) => {
  return toast(message, {
    ...defaultOptions,
    ...options,
  });
};

export default {
  success: showSuccess,
  error: showError,
  info: showInfo,
  warning: showWarning,
  loading: showLoading,
  promise: showPromise,
  dismiss: dismissToast,
  dismissAll: dismissAllToasts,
  custom: showCustom,
};
