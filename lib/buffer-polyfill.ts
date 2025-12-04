// Buffer polyfill for React Native
import { Buffer as BufferPolyfill } from '@craftzdog/react-native-buffer';

// Make Buffer available globally
(global as any).Buffer = (global as any).Buffer || BufferPolyfill;

export { BufferPolyfill as Buffer };

