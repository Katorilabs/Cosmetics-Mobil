import { Platform } from 'react-native';
import { createApi, resolveApiUrl } from './api-client';

// Expo substitutes this literal environment access when bundling. No server secrets belong here.
export const api = createApi(() => resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, Platform.OS, __DEV__));
