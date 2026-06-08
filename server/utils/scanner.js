import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mkv', '.mov', '.avi']);
const SUBTITLE_EXTENSIONS = new Set(['.vtt', '.srt']);
const IGNORED_RESOURCE_NAMES = new Set(['thumbs.db', '.ds_store']);

/**
 * Natural sort comparator: "10 - Foo" comes after "2 - Bar"
 */
function naturalCompare(a, b) {
  const re = /(\d+)/g;
  const aParts = a.split(re);
  const bParts = b.split(re);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] ?? '';
    const bPart = bParts[i] ?? '';
    const aNum = parseInt(aPart, 10);
    const bNum = parseInt(bPart, 10);
    if (!isNaN(aNum) && !isNaN(bNum)) {
      if (aNum !== bNum) return aNum - bNum;
    } else {
      const cmp = aPart.localeCompare(bPart);
      if (cmp !== 0) return cmp;
    }
  }
  return 0;
}

/**
 * Strip leading numbers, separators, and extensions from a name for display.
 * "01 - Introduction" → "Introduction"
 * "003_my_lesson.mp4" → "My lesson"
 * "Section.02.React.Basics" → "React Basics"
 */
function cleanTitle(name, isDirectory = false) {
  // Remove file extension (skip for directories — they have no extension)
  let title = isDirectory ? name : name.replace(/\.[^/.]+$/, '');

  // Strip leading numeric prefixes (digits followed by separators)
  title = title.replace(/^[\d]+[\s._\-–—]+/, '');

  // Replace remaining separators (dots, underscores) with spaces
  title = title.replace(/[._]+/g, ' ');

  // Collapse multiple spaces
  title = title.replace(/\s{2,}/g, ' ').trim();

  // Capitalize first letter
  if (title.length > 0) {
    title = title.charAt(0).toUpperCase() + title.slice(1);
  }

  return title || name;
}

/**
 * Attempt to find a subtitle file for a given video file path.
 * Searches the same directory for exact base-name match, then fuzzy match.
 */
function findSubtitle(videoPath) {
  const dir = path.dirname(videoPath);
  const baseName = path.basename(videoPath, path.extname(videoPath)).toLowerCase();

  let entries;
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return null;
  }

  const subtitleFiles = entries.filter((f) =>
    SUBTITLE_EXTENSIONS.has(path.extname(f).toLowerCase())
  );

  // Exact base-name match (case-insensitive)
  for (const f of subtitleFiles) {
    const subBase = path.basename(f, path.extname(f)).toLowerCase();
    if (subBase === baseName) {
      return path.join(dir, f);
    }
  }

  // Fuzzy match: subtitle shares the majority of words with the video name
  const videoWords = baseName.split(/[\s._\-]+/).filter(Boolean);
  for (const f of subtitleFiles) {
    const subBase = path.basename(f, path.extname(f)).toLowerCase();
    const subWords = subBase.split(/[\s._\-]+/).filter(Boolean);
    const shared = videoWords.filter((w) => subWords.includes(w)).length;
    if (videoWords.length > 0 && shared / videoWords.length >= 0.5) {
      return path.join(dir, f);
    }
  }

  return null;
}

function isResourceFile(fileName) {
  const lower = fileName.toLowerCase();
  const ext = path.extname(lower);
  return (
    ext &&
    !VIDEO_EXTENSIONS.has(ext) &&
    !SUBTITLE_EXTENSIONS.has(ext) &&
    !lower.startsWith('.') &&
    !IGNORED_RESOURCE_NAMES.has(lower)
  );
}

function classifyResource(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) return 'image';
  if (['.pdf'].includes(ext)) return 'pdf';
  if (['.html', '.htm'].includes(ext)) return 'html';
  if (['.url', '.webloc'].includes(ext)) return 'link';
  if (['.txt', '.md', '.rtf'].includes(ext)) return 'text';
  if (['.doc', '.docx'].includes(ext)) return 'document';
  if (['.xls', '.xlsx', '.csv', '.tsv'].includes(ext)) return 'spreadsheet';
  if (['.ppt', '.pptx'].includes(ext)) return 'presentation';
  if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(ext)) return 'archive';
  return ext ? ext.slice(1) : 'file';
}

function resourceName(fileName) {
  const cleaned = cleanTitle(fileName);
  return cleaned || fileName;
}

function baseWords(fileName) {
  const base = path.basename(fileName, path.extname(fileName)).toLowerCase();
  return base.split(/[\s._\-–—]+/).filter(Boolean);
}

function leadingLessonNumber(fileName) {
  const match = path.basename(fileName).match(/^\s*(\d+)(?=[\s.)_-])/);
  return match ? Number(match[1]) : null;
}

function basenameScore(videoName, resourceNameValue) {
  const videoBase = path.basename(videoName, path.extname(videoName)).toLowerCase();
  const resourceBase = path.basename(resourceNameValue, path.extname(resourceNameValue)).toLowerCase();

  const videoNumber = leadingLessonNumber(videoName);
  const resourceNumber = leadingLessonNumber(resourceNameValue);
  if (videoNumber != null && videoNumber === resourceNumber) return 95;

  if (videoBase === resourceBase) return 100;
  if (resourceBase.startsWith(videoBase) || videoBase.startsWith(resourceBase)) return 90;

  const videoWords = baseWords(videoName);
  const resourceWords = baseWords(resourceNameValue);
  if (videoWords.length === 0 || resourceWords.length === 0) return 0;

  const shared = videoWords.filter((w) => resourceWords.includes(w)).length;
  return shared / Math.max(videoWords.length, resourceWords.length);
}

function statResource(filePath, fileName, sortOrder) {
  let sizeBytes = null;
  try {
    sizeBytes = fs.statSync(filePath).size;
  } catch {
    sizeBytes = null;
  }

  return {
    name: resourceName(fileName),
    file_path: filePath,
    file_type: classifyResource(fileName),
    size_bytes: sizeBytes,
    sort_order: sortOrder,
  };
}

function assignResources(dirPath, videoFiles, resourceFiles) {
  const resourcesByVideo = new Map(videoFiles.map((file) => [file, []]));
  if (videoFiles.length === 0 || resourceFiles.length === 0) return resourcesByVideo;

  const ordered = [...videoFiles.map((name) => ({ name, kind: 'video' })), ...resourceFiles.map((name) => ({ name, kind: 'resource' }))]
    .sort((a, b) => naturalCompare(a.name, b.name));

  for (const resource of resourceFiles) {
    let targetVideo = null;
    let bestScore = 0;

    for (const video of videoFiles) {
      const score = basenameScore(video, resource);
      if (score > bestScore) {
        bestScore = score;
        targetVideo = video;
      }
    }

    if (bestScore < 0.5) {
      const resourceIndex = ordered.findIndex((item) => item.kind === 'resource' && item.name === resource);
      for (let i = resourceIndex - 1; i >= 0; i--) {
        if (ordered[i].kind === 'video') {
          targetVideo = ordered[i].name;
          break;
        }
      }
    }

    if (targetVideo) {
      const current = resourcesByVideo.get(targetVideo) ?? [];
      current.push(statResource(path.join(dirPath, resource), resource, current.length));
      resourcesByVideo.set(targetVideo, current);
    }
  }

  return resourcesByVideo;
}

/**
 * Attempt to get video duration via ffprobe.
 * Returns seconds as a number, or null if ffprobe is unavailable or errors.
 */
function getVideoDuration(filePath) {
  try {
    const result = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
      { timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    const seconds = parseFloat(result.toString().trim());
    return isNaN(seconds) ? null : Math.round(seconds);
  } catch {
    return null;
  }
}

/**
 * Recursively scan a directory and build the lesson list.
 * Returns { lessons, tree }
 *
 * @param {string} dirPath - Absolute path to scan
 * @param {string} sectionPath - Relative section path string (e.g. "Section 1/Subsection A")
 * @param {number} depth - Current depth level (0 = root)
 * @param {Array} flatLessons - Accumulator for flat lesson list (mutated in place)
 */
function scanDirectory(dirPath, sectionPath, depth, flatLessons) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return null;
  }

  // Separate dirs and video files, then natural-sort each group
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(naturalCompare);

  const files = entries
    .filter((e) => e.isFile() && VIDEO_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort(naturalCompare);

  const resourceFiles = entries
    .filter((e) => e.isFile() && isResourceFile(e.name))
    .map((e) => e.name)
    .sort(naturalCompare);

  const resourcesByVideo = assignResources(dirPath, files, resourceFiles);

  // Build direct lessons (video files in this folder)
  const directLessons = files.map((fileName) => {
    const filePath = path.join(dirPath, fileName);
    return {
      title: cleanTitle(fileName),
      file_path: filePath,
      subtitle_path: findSubtitle(filePath),
      section_path: sectionPath,
      depth_level: depth,
      sort_order: 0, // assigned after full traversal
      duration_seconds: getVideoDuration(filePath),
      resources: resourcesByVideo.get(fileName) ?? [],
    };
  });

  // Build subtree sections
  const sections = [];
  for (const dirName of dirs) {
    const childPath = path.join(dirPath, dirName);
    const childSectionPath = sectionPath ? `${sectionPath}/${cleanTitle(dirName, true)}` : cleanTitle(dirName, true);
    const subtree = scanDirectory(childPath, childSectionPath, depth + 1, flatLessons);
    if (subtree && (subtree.lessons.length > 0 || subtree.sections.length > 0)) {
      sections.push({
        name: cleanTitle(dirName, true),
        path: childSectionPath,
        depth: depth + 1,
        lessons: subtree.lessons,
        sections: subtree.sections,
      });
    }
  }

  // Add this folder's direct lessons to flat list before recursing deeper
  // (depth-first: files in current folder appear before subdirectory content)
  for (const lesson of directLessons) {
    flatLessons.push(lesson);
  }

  return { lessons: directLessons, sections };
}

/**
 * Main scanner entry point.
 * @param {string} rootPath - Absolute path to the course root folder
 * @returns {{ tree: object, flatLessons: Array }}
 */
export function scanCourseFolder(rootPath) {
  if (!fs.existsSync(rootPath)) {
    throw new Error(`Folder does not exist: ${rootPath}`);
  }

  const flatLessons = [];
  const tree = scanDirectory(rootPath, '', 0, flatLessons);

  if (!tree) {
    throw new Error(`Unable to read folder: ${rootPath}`);
  }

  // Assign global sort_order based on depth-first traversal position
  flatLessons.forEach((lesson, index) => {
    lesson.sort_order = index;
  });

  return { tree, flatLessons };
}
