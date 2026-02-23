import { create } from 'zustand';

const usePlayerStore = create((set) => ({
  lesson: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  playbackSpeed: 1,
  subtitlesEnabled: false,
  buffered: 0,

  setLesson: (lesson) => set({ lesson, currentTime: 0, isPlaying: false }),
  setPlaying: (isPlaying) => set({ isPlaying }),
  setTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setVolume: (volume) => set({ volume }),
  setSpeed: (playbackSpeed) => set({ playbackSpeed }),
  toggleSubtitles: () => set((s) => ({ subtitlesEnabled: !s.subtitlesEnabled })),
  setBuffered: (buffered) => set({ buffered }),
}));

export default usePlayerStore;
