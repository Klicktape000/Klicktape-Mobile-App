import { StyleSheet } from 'react-native';

// Common color constants
export const COMMON_COLORS = {
  // Primary colors
  primary: '#007AFF',
  secondary: '#34C759',
  warning: '#FF9500',
  danger: '#FF3B30',
  
  // Background colors
  backgroundLight: '#f5f5f5',
  backgroundDark: '#1a1a1a',
  backgroundWhite: '#ffffff',
  backgroundBlack: '#000000',
  
  // Status colors
  success: '#4CAF50',
  error: '#F44336',
  info: '#2196F3',
  
  // Neutral colors
  gray: '#808080',
  lightGray: '#f0f0f0',
  darkGray: '#333333',
  
  // Accent colors
  gold: '#FFD700',
  red: '#FF0000',
} as const;

// Common style patterns
export const COMMON_STYLES = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: COMMON_COLORS.backgroundLight,
  },
  
  // Button styles
  primaryButton: {
    backgroundColor: COMMON_COLORS.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  secondaryButton: {
    backgroundColor: COMMON_COLORS.secondary,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  warningButton: {
    backgroundColor: COMMON_COLORS.warning,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  dangerButton: {
    backgroundColor: COMMON_COLORS.danger,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Text styles
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: COMMON_COLORS.darkGray,
  },
  
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: COMMON_COLORS.darkGray,
  },
  
  // Card styles
  card: {
    backgroundColor: COMMON_COLORS.backgroundWhite,
    padding: 15,
    marginBottom: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Status styles
  statusConnected: {
    backgroundColor: '#d4edda',
    color: '#155724',
  },
  
  statusDisconnected: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
  },
  
  // Utility styles
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  flexRow: {
    flexDirection: 'row',
  },
  
  flexColumn: {
    flexDirection: 'column',
  },
  
  marginBottom: {
    marginBottom: 10,
  },
  
  marginTop: {
    marginTop: 10,
  },
  
  padding: {
    padding: 10,
  },
  
  paddingHorizontal: {
    paddingHorizontal: 15,
  },
  
  paddingVertical: {
    paddingVertical: 10,
  },
});

// Helper function to create consistent button styles
export const createButtonStyle = (backgroundColor: string, textColor: string = 'white') => ({
  backgroundColor,
  padding: 15,
  borderRadius: 8,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  textColor,
});

// Helper function to create consistent card styles
export const createCardStyle = (backgroundColor: string = COMMON_COLORS.backgroundWhite) => ({
  backgroundColor,
  padding: 15,
  marginBottom: 15,
  borderRadius: 8,
  shadowColor: '#000',
  shadowOffset: {
    width: 0,
    height: 2,
  },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
});
