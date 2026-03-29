import { create } from 'zustand';
import { authApi } from '../api';

interface AuthState {
  token: string | null;
  username: string;
  role: string;
  isLoggedIn: boolean;

  login: (username: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  username: '',
  role: '',
  isLoggedIn: !!localStorage.getItem('token'),

  login: async (username, password, remember = false) => {
    const res = await authApi.login({ username, password, remember_me: remember });
    const { access_token, username: name, role } = res.data;
    localStorage.setItem('token', access_token);
    set({ token: access_token, username: name, role, isLoggedIn: true });
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ token: null, username: '', role: '', isLoggedIn: false });
  },

  fetchMe: async () => {
    const res = await authApi.me();
    set({ username: res.data.username, role: res.data.role });
  },
}));
