import { create } from 'zustand';

const useUIStore = create((set) => ({
  sidebarOpen: true,
  activeModal: null,
  theme: 'dark',
  toasts: [],

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),
  setTheme: (theme) => set({ theme }),

  addToast: (message, type = 'error') =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        { id: Date.now(), message, type },
      ],
    })),

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export default useUIStore;
