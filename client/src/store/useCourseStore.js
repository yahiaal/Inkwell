import { create } from 'zustand';

const useCourseStore = create((set) => ({
  course: null,
  lessons: [],   // flat ordered list
  tree: null,    // nested tree for sidebar

  setCourse: (course) =>
    set({
      course,
      lessons: course?.lessons ?? [],
      tree: course?.tree ?? null,
    }),

  clearCourse: () => set({ course: null, lessons: [], tree: null }),
}));

export default useCourseStore;
