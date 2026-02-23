import { useEffect } from 'react';
import { api } from '../utils/api.js';
import useProgressStore from '../store/useProgressStore.js';

export function useProgress(courseId) {
  const loadProgress = useProgressStore((s) => s.loadProgress);

  useEffect(() => {
    if (!courseId) return;
    api.progress.getByCourse(courseId).then((data) => {
      loadProgress(data);
    }).catch(() => {});
  }, [courseId, loadProgress]);
}
