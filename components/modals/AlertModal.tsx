import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';

export type AlertType = 'success' | 'warning' | 'error' | 'info' | 'confirm';

export interface AlertModalProps {
  visible: boolean;
  type: AlertType;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

const { width } = Dimensions.get('window');

export const AlertModal: React.FC<AlertModalProps> = ({
  visible,
  type,
  title,
  message,
  onClose,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = false,
}) => {
  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          color: '#10B981',
          icon: '✅',
          backgroundColor: '#ECFDF5',
        };
      case 'warning':
        return {
          color: '#F59E0B',
          icon: '⚠️',
          backgroundColor: '#FFFBEB',
        };
      case 'error':
        return {
          color: '#EF4444',
          icon: '❌',
          backgroundColor: '#FEF2F2',
        };
      case 'info':
        return {
          color: '#3B82F6',
          icon: 'ℹ️',
          backgroundColor: '#EFF6FF',
        };
      case 'confirm':
        return {
          color: '#8B5CF6',
          icon: '❓',
          backgroundColor: '#F5F3FF',
        };
      default:
        return {
          color: '#6B7280',
          icon: 'ℹ️',
          backgroundColor: '#F9FAFB',
        };
    }
  };

  const config = getTypeConfig();

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />
      <BlurView intensity={20} style={styles.overlay}>
        <View style={styles.container}>
          <View style={[styles.modal, { backgroundColor: config.backgroundColor }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.icon}>{config.icon}</Text>
              <Text style={[styles.title, { color: config.color }]}>{title}</Text>
            </View>

            {/* Message */}
            <Text style={styles.message}>{message}</Text>

            {/* Actions */}
            <View style={styles.actions}>
              {showCancel && (
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>{cancelText}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.button, styles.confirmButton, { backgroundColor: config.color }]}
                onPress={handleConfirm}
                activeOpacity={0.7}
              >
                <Text style={styles.confirmText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modal: {
    width: width * 0.85,
    maxWidth: 400,
    borderRadius: 16,
    padding: 24,
    boxShadow: "0px 10px 20px rgba(0, 0, 0, 0.25)",
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  confirmButton: {
    boxShadow: "0px 2px 4px rgba(0, 0, 0, 0.1)",
    elevation: 2,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
