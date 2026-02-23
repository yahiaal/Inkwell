import { create } from 'zustand';

const useProgressStore = create((set) => ({
  // { [lessonId]: { watchedSeconds, completed, durationSeconds } }
  progressMap: {},

  setProgress: (lessonId, data) =>
    set((state) => ({
      progressMap: {
        ...state.progressMap,
        [lessonId]: { ...state.progressMap[lessonId], ...data },
      },
    })),

  markComplete: (lessonId) =>
    set((state) => ({
      progressMap: {
        ...state.progressMap,
        [lessonId]: { ...state.progressMap[lessonId], completed: true },
      },
    })),

  loadProgress: (progressMapData) => set({ progressMap: progressMapData }),

  clearProgress: () => set({ progressMap: {} }),
}));

export default useProgressStore;
