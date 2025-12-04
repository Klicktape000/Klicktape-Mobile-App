import { AlertType } from '../../components/modals/AlertModal';

export interface AlertConfig {
  type: AlertType;
  title: string;
  message: string;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

class AlertService {
  private listeners: ((config: AlertConfig | null) => void)[] = [];
  private currentAlert: AlertConfig | null = null;

  subscribe(listener: (config: AlertConfig | null) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(config: AlertConfig | null) {
    this.currentAlert = config;
    this.listeners.forEach(listener => listener(config));
  }

  show(config: AlertConfig) {
    this.notify(config);
    
    // Auto close for success and info messages
    if (config.autoClose && (config.type === 'success' || config.type === 'info')) {
      setTimeout(() => {
        this.hide();
      }, config.autoCloseDelay || 3000);
    }
  }

  hide() {
    this.notify(null);
  }

  // Convenience methods
  success(title: string, message: string, autoClose = true) {
    this.show({
      type: 'success',
      title,
      message,
      autoClose,
      autoCloseDelay: 2000,
    });
  }

  error(title: string, message: string) {
    this.show({
      type: 'error',
      title,
      message,
    });
  }

  warning(title: string, message: string) {
    this.show({
      type: 'warning',
      title,
      message,
    });
  }

  info(title: string, message: string, autoClose = true) {
    this.show({
      type: 'info',
      title,
      message,
      autoClose,
      autoCloseDelay: 3000,
    });
  }

  confirm(
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText = 'Confirm',
    cancelText = 'Cancel'
  ) {
    this.show({
      type: 'confirm',
      title,
      message,
      onConfirm,
      confirmText,
      cancelText,
      showCancel: true,
    });
  }

  // Network error handler
  networkError(context: string = 'Network operation') {
    this.error(
      'Network Error',
      `${context} failed. Please check your internet connection and try again.`
    );
  }

  // Performance warning
  performanceWarning(component: string, details: string) {
    this.warning(
      'Performance Warning',
      `${component} is experiencing performance issues: ${details}`
    );
  }

  // Debug info (only in development)
  debug(title: string, message: string) {
    if (__DEV__) {
      this.info(`Debug: ${title}`, message, true);
    }
  }
}

export const alertService = new AlertService();
