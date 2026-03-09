const envUrl = 'http://localhost:3001';
const BASE_URL = (() => {
  if (!envUrl) return `http://${window.location.hostname}:3001`;
  if (envUrl.includes('localhost') && window.location.hostname !== 'localhost') {
    return envUrl.replace('localhost', window.location.hostname);
  }
  return envUrl;
})();

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorData;
    try {
      errorData = await res.json();
    } catch {
      errorData = { error: `HTTP ${res.status}`, code: 'HTTP_ERROR' };
    }
    const err = new Error(errorData.error || `HTTP ${res.status}`);
    err.code = errorData.code;
    err.status = res.status;
    throw err;
  }

  return res.json();
}

// ─── Courses ─────────────────────────────────────────────────
export const api = {
  courses: {
    scan: (folderPath) =>
      request('/courses/scan', {
        method: 'POST',
        body: JSON.stringify({ folderPath }),
      }),

    list: () => request('/courses'),

    get: (id) => request(`/courses/${id}`),

    update: (id, data) =>
      request(`/courses/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),

    remove: (id) =>
      request(`/courses/${id}`, { method: 'DELETE' }),

    updateLessonDuration: (courseId, lessonId, durationSeconds) =>
      request(`/courses/${courseId}/lesson/${lessonId}`, {
        method: 'PATCH',
        body: JSON.stringify({ durationSeconds }),
      }),
  },

  // ─── Progress ───────────────────────────────────────────────
  progress: {
    upsert: (data) =>
      request('/progress', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getByCourse: (courseId) => request(`/progress/${courseId}`),

    logSession: (data) =>
      request('/progress/log-session', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getResume: (courseId) => request(`/progress/${courseId}/resume`),

    resetCourse: (courseId) =>
      request(`/progress/course/${courseId}`, { method: 'DELETE' }),
  },

  // ─── Bookmarks ──────────────────────────────────────────────
  bookmarks: {
    getByCourse: (courseId) => request(`/bookmarks/${courseId}`),

    create: (data) =>
      request('/bookmarks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    remove: (id) =>
      request(`/bookmarks/${id}`, { method: 'DELETE' }),
  },

  // ─── Notes ──────────────────────────────────────────────────
  notes: {
    getByLesson: (lessonId) => request(`/notes/${lessonId}`),

    upsert: (data) =>
      request('/notes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    remove: (id) =>
      request(`/notes/${id}`, { method: 'DELETE' }),
  },

  // ─── Stats ──────────────────────────────────────────────────
  stats: {
    overview: () => request('/stats/overview'),
    weekly: () => request('/stats/weekly'),
    perCourse: () => request('/stats/per-course'),
  },

  // ─── Settings ───────────────────────────────────────────────
  settings: {
    get: () => request('/settings'),

    update: (data) =>
      request('/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  },

  // ─── Browse ─────────────────────────────────────────────────
  browse: {
    pickFolder: () =>
      fetch(`${BASE_URL}/api/browse-folder`).then((r) => r.json()),
  },

  // ─── Subtitles ──────────────────────────────────────────────
  subtitles: {
    generate: (lessonIds, force = false) =>
      request('/subtitles/generate', {
        method: 'POST',
        body: JSON.stringify({ lessonIds, force }),
      }),

    getQueue: () => request('/subtitles/queue'),

    cancelJob: (jobId) =>
      request(`/subtitles/queue/${jobId}`, { method: 'DELETE' }),

    clearHistory: () =>
      request('/subtitles/history', { method: 'DELETE' }),

    getMissing: (courseId) => request(`/subtitles/missing/${courseId}`),

    check: () => request('/subtitles/check'),
  },

  // ─── Media URLs (not fetched, used as src attributes) ───────
  videoUrl: (lessonId) => `${BASE_URL}/api/video/${lessonId}`,
  subtitleUrl: (lessonId) => `${BASE_URL}/api/subtitle/${lessonId}`,
};
