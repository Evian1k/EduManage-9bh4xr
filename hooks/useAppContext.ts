import { useContext } from 'react';
import { AppContext, AppContextType } from '@/contexts/AppContext';

export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
}
