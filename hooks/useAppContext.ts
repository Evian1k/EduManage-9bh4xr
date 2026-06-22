import { useContext } from 'react';
import { AppContext, AppContextType } from '@/contexts/AppContext';

/**
 * Access the global application context (current user role, school, school_user
 * record, platform-admin flag, rulebook acceptance). Throws if used outside
 * an `<AppProvider>`.
 */
export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
