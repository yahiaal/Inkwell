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

  setLessonSubtitlePath: (lessonId, path) =>
    set((state) => {
      if (!state.course) return state;

      const updateLessons = (lessons) =>
        lessons?.map((l) =>
          String(l.id) === String(lessonId) ? { ...l, subtitle_path: path } : l
        );

      const updateTree = (node) => {
        if (!node) return node;
        return {
          ...node,
          lessons: updateLessons(node.lessons),
          sections: node.sections?.map(updateTree),
        };
      };

      return {
        lessons: updateLessons(state.lessons),
        course: { ...state.course, lessons: updateLessons(state.course.lessons), tree: updateTree(state.course.tree) },
        tree: updateTree(state.tree),
      };
    }),
}));

export default useCourseStore;
