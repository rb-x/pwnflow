import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authService } from "@/services/auth/authService";
import type { User, UserCreate } from "@/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (data: UserCreate) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const user = await authService.login(username, password);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({
            error: error.response?.data?.detail || "Invalid credentials",
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (data: UserCreate) => {
        set({ isLoading: true, error: null });
        try {
          const user = await authService.register(data);
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          const errorDetail = error.response?.data?.detail || "Registration failed";
          
          // Handle specific registration disabled error
          if (error.response?.status === 403 && errorDetail.includes("Registration is disabled")) {
            set({
              error: "Registration is currently disabled. Contact your administrator to create an account.",
              isLoading: false,
            });
          } else {
            set({
              error: errorDetail,
              isLoading: false,
            });
          }
          throw error;
        }
      },

      logout: async () => {
        await authService.logout();
        set({ user: null, isAuthenticated: false });
      },

      checkAuth: async () => {
        if (!authService.isAuthenticated()) {
          set({ user: null, isAuthenticated: false, isLoading: false });
          return;
        }

        set({ isLoading: true });
        try {
          const user = await authService.getCurrentUser();
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "pwnflow-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
