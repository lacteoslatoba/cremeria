import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
    id: string;
    name: string | null;
    email: string | null;
    role: string;
}

interface AuthState {
    user: User | null;
    setUser: (user: User | null) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            setUser: (user) => set({ user }),
            logout: () => set({ user: null }),
        }),
        {
            name: "auth-storage", // name of the item in the storage (must be unique)
        }
    )
);
