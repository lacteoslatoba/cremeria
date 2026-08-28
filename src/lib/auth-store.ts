import { create } from "zustand";

export interface User {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    role: string;
    username?: string | null;
    address?: string | null;
}

interface AuthState {
    user: User | null;
    initialized: boolean;
    setUser: (user: User | null) => void;
    init: () => Promise<void>;
    logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
    user: null,
    initialized: false,

    setUser: (user) => set({ user, initialized: true }),

    // Restaura la sesión desde la cookie HttpOnly (segura) llamando a /api/auth/me.
    // Nunca confía en localStorage, que puede editarse; el rol real vive en la BD
    // y en la cookie firmada por el servidor.
    init: async () => {
        try {
            const res = await fetch("/api/auth/me", { credentials: "include" });
            const data = await res.json();
            set({ user: data?.user || null, initialized: true });
        } catch {
            set({ user: null, initialized: true });
        }
    },

    logout: async () => {
        try {
            await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        } catch {
            // ignora errores de red en logout
        }
        set({ user: null, initialized: true });
    },
}));

