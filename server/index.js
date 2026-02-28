import "dotenv/config";
import express from "express";
import cors from "cors";
import db from "./db.js";

import coursesRouter from "./routes/courses.js";
import progressRouter from "./routes/progress.js";
import bookmarksRouter from "./routes/bookmarks.js";
import notesRouter from "./routes/notes.js";
import statsRouter from "./routes/stats.js";
import settingsRouter from "./routes/settings.js";
import videoRouter from "./routes/video.js";
import subtitleRouter from "./routes/subtitle.js";
import subtitlesRouter from "./routes/subtitles.js";
import browseRouter from "./routes/browse.js";

// ─── Stale subtitle job cleanup on startup ───────────────────
db.prepare(
  `UPDATE subtitle_jobs SET status = 'failed', finished_at = ?, error_message = 'Server restarted before job could run' WHERE status IN ('queued', 'processing')`
).run(new Date().toISOString());

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:4173",
      "http://course.my:4173",
    ],
    credentials: true,
    maxAge: 86400,
  }),
);

app.use(express.json());

// API routes
app.use("/api/courses", coursesRouter);
app.use("/api/progress", progressRouter);
app.use("/api/bookmarks", bookmarksRouter);
app.use("/api/notes", notesRouter);
app.use("/api/stats", statsRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/video", videoRouter);
app.use("/api/subtitle", subtitleRouter);
app.use("/api/subtitles", subtitlesRouter);
app.use("/api/browse-folder", browseRouter);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LMS server running at http://localhost:${PORT}`);
});
