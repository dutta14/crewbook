import { useContext } from 'react';
import {
  EncryptedStorageContext,
  type EncryptedStorageContextValue,
} from '../components/EncryptedStorageProvider';

export function useEncryptedStorage(): EncryptedStorageContextValue {
  const context = useContext(EncryptedStorageContext);
  if (!context) {
    throw new Error('useEncryptedStorage must be used within an EncryptedStorageProvider');
  }
  return context;
}
