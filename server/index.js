import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import coursesRouter from './routes/courses.js';
import progressRouter from './routes/progress.js';
import bookmarksRouter from './routes/bookmarks.js';
import notesRouter from './routes/notes.js';
import statsRouter from './routes/stats.js';
import settingsRouter from './routes/settings.js';
import videoRouter from './routes/video.js';
import subtitleRouter from './routes/subtitle.js';
import browseRouter from './routes/browse.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// API routes
app.use('/api/courses', coursesRouter);
app.use('/api/progress', progressRouter);
app.use('/api/bookmarks', bookmarksRouter);
app.use('/api/notes', notesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/video', videoRouter);
app.use('/api/subtitle', subtitleRouter);
app.use('/api/browse-folder', browseRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`LMS server running at http://localhost:${PORT}`);
});
