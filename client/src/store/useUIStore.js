import { create } from 'zustand';
import { api } from '../utils/api.js';

const useUIStore = create((set) => ({
  sidebarOpen: true,
  activeModal: null,
  theme: 'dark',
  toasts: [],
  subtitleQueue: { processing: null, queued: [], recentlyCompleted: [] },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openModal: (name) => set({ activeModal: name }),
  closeModal: () => set({ activeModal: null }),
  setTheme: (theme) => set({ theme }),
  setSubtitleQueue: (queueData) => set({ subtitleQueue: queueData }),

  refreshSubtitleQueue: async () => {
    try {
      const data = await api.subtitles.getQueue();
      set({ subtitleQueue: data });
    } catch {
      // Non-critical — panel will retry on next poll
    }
  },

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
