import React, { useEffect, useState } from 'react';
import { AlertModal } from '../modals/AlertModal';
import { alertService, AlertConfig } from '../../lib/utils/alertService';

interface AlertProviderProps {
  children: React.ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);

  useEffect(() => {
    const unsubscribe = alertService.subscribe((config) => {
      setAlertConfig(config);
    });

    return unsubscribe;
  }, []);

  const handleClose = () => {
    alertService.hide();
  };

  const handleConfirm = () => {
    if (alertConfig?.onConfirm) {
      alertConfig.onConfirm();
    }
    alertService.hide();
  };

  return (
    <>
      {children}
      {alertConfig && (
        <AlertModal
          visible={true}
          type={alertConfig.type}
          title={alertConfig.title}
          message={alertConfig.message}
          onClose={handleClose}
          onConfirm={alertConfig.onConfirm ? handleConfirm : undefined}
          confirmText={alertConfig.confirmText}
          cancelText={alertConfig.cancelText}
          showCancel={alertConfig.showCancel}
        />
      )}
    </>
  );
};
