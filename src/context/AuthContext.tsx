import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, Household, HouseholdMember } from '../types/index.js';
import { ApiService } from '../services/api.js';

interface AuthContextType {
  currentUser: User | null;
  activeHousehold: Household | null;
  householdMembers: HouseholdMember[];
  allUsers: User[];
  isLoading: boolean;
  error: string | null;
  switchUser: (userId: string) => Promise<void>;
  refreshHousehold: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeHousehold, setActiveHousehold] = useState<Household | null>(null);
  const [householdMembers, setHouseholdMembers] = useState<HouseholdMember[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize with Wallace by default
  const initAuth = async (targetUserId: string = 'usr-wallace-001') => {
    try {
      setIsLoading(true);
      setError(null);

      // Load all available users
      const usersRes = await ApiService.getUsers();
      setAllUsers(usersRes.users);

      // Login target user
      const loginRes = await ApiService.login(targetUserId);
      setCurrentUser(loginRes.user);
      setActiveHousehold(loginRes.active_household);

      if (loginRes.active_household) {
        const hhRes = await ApiService.getHousehold(loginRes.active_household.id, loginRes.user.id);
        setHouseholdMembers(hhRes.members);
      } else {
        setHouseholdMembers([]);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro na autenticação inicial';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const switchUser = async (userId: string) => {
    await initAuth(userId);
  };

  const refreshHousehold = async () => {
    if (!currentUser || !activeHousehold) return;
    try {
      const hhRes = await ApiService.getHousehold(activeHousehold.id, currentUser.id);
      setHouseholdMembers(hhRes.members);
      setActiveHousehold(hhRes.household);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeHousehold,
        householdMembers,
        allUsers,
        isLoading,
        error,
        switchUser,
        refreshHousehold
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
