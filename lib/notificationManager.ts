// Conditional notification manager that chooses the right service based on environment
import Constants from 'expo-constants';
import { alertService } from './utils/alertService';

// Determine environment
const isExpoGo = Constants.appOwnership === 'expo';

let notificationService: any;

if (isExpoGo) {
  // Use stub service for Expo Go
  if (__DEV__) {
    alertService.debug('Notification Manager', 'Expo Go detected - Using notification stub');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { notificationServiceStub } = require('./notificationServiceStub');
  notificationService = notificationServiceStub;
} else {
  // Use full service for development builds
  if (__DEV__) {
    alertService.debug('Notification Manager', 'Development build detected - Using full notification service');
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { notificationService: fullService } = require('./notificationService');
  notificationService = fullService;
}

export { notificationService };
export type { NotificationData } from './notificationServiceStub';

