import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { AppError } from "./roadmap.js";

const SESSION_INDEX_FILE = "session-index.json";
const SESSION_INDEX_VERSION = 1;
const EMPTY_JSONL = "";
const TEXT_EXTENSIONS = new Set([".md", ".mdx", ".txt", ".rst", ".adoc"]);
const MARKDOWN_EXTENSIONS = new Set([".md", ".mdx"]);
const COMMENT_KINDS = new Set([
  "instruction",
  "concern",
  "question",
  "evidence",
  "disagreement",
  "confirmation",
  "recommendation",
  "conclusion",
]);
const COMMENT_STATUSES = new Set(["open", "resolved", "accepted", "rejected", "deferred", "stale"]);

function nowIso() {
  return new Date().toISOString();
}

function normalizeSlashes(value) {
  return String(value || "").replaceAll("\\", "/");
}

function normalizeFileKey(filePath, platform = process.platform) {
  const normalized = normalizeSlashes(path.resolve(filePath));
  return platform === "win32" ? normalized.toLowerCase() : normalized;
}

function shortHash(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);
}

function hashContent(buffer) {
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

function hashText(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value)).digest("hex")}`;
}

function slugifyBasename(filePath) {
  const parsed = path.parse(filePath);
  const source = parsed.name || parsed.base || "file";
  const slug = source
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "file";
}

function makeSessionId(fileKey, filePath) {
  return `${slugifyBasename(filePath)}-${shortHash(fileKey)}`;
}

function normalizeDisplayPath(value) {
  return normalizeSlashes(path.resolve(value));
}

function isKnownTextExtension(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(extension) || extension === "";
}

function detectFileKind(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (MARKDOWN_EXTENSIONS.has(extension)) {
    return { kind: "markdown", markdown: true };
  }
  return { kind: "text", markdown: false };
}

function looksBinary(buffer) {
  if (buffer.includes(0)) {
    return true;
  }

  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  if (sample.length === 0) {
    return false;
  }

  let controlCount = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13) {
      continue;
    }
    if (byte < 32) {
      controlCount += 1;
    }
  }

  return controlCount / sample.length > 0.05;
}

function splitLinesPreserveText(text) {
  return String(text).split(/\r?\n/);
}

function stripClosingHeadingHashes(title) {
  return title.replace(/\s+#+\s*$/, "").trim();
}

export function parseMarkdownOutline(text) {
  const lines = splitLinesPreserveText(text);
  const outline = [];
  const headingStack = [];
  let inFence = false;

  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return;
    }

    if (inFence) {
      return;
    }

    const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (!match) {
      return;
    }

    const level = match[1].length;
    const title = stripClosingHeadingHashes(match[2]);
    if (!title) {
      return;
    }

    headingStack.length = level - 1;
    headingStack[level - 1] = title;
    const headingPath = headingStack.filter(Boolean);

    outline.push({
      level,
      title,
      headingPath,
      lineStart: index + 1,
    });
  });

  return outline;
}

function lineRangeForOffset(text, offset, length) {
  const before = text.slice(0, offset);
  const selected = text.slice(offset, offset + length);
  const lineStart = before.split(/\r?\n/).length;
  const lineEnd = lineStart + selected.split(/\r?\n/).length - 1;
  return { lineStart, lineEnd };
}

function lineTextForRange(text, lineStart, lineEnd) {
  const lines = splitLinesPreserveText(text);
  return lines.slice(lineStart - 1, lineEnd).join("\n");
}

function headingPathForLine(text, lineNumber) {
  const outline = parseMarkdownOutline(text);
  let current = [];

  for (const heading of outline) {
    if (heading.lineStart > lineNumber) {
      break;
    }
    current = heading.headingPath;
  }

  return current;
}

function findQuoteOccurrences(text, quote) {
  if (!quote) {
    return [];
  }

  const occurrences = [];
  let offset = text.indexOf(quote);

  while (offset !== -1) {
    occurrences.push({
      offset,
      ...lineRangeForOffset(text, offset, quote.length),
    });
    offset = text.indexOf(quote, offset + Math.max(quote.length, 1));
  }

  return occurrences;
}

function sameHeadingPath(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function createTextAnchor(text, options = {}) {
  const quote = String(options.quote || "");
  if (!quote) {
    throw new AppError("Text anchors require a quote.", 400, "bad_request");
  }

  const occurrences = findQuoteOccurrences(text, quote);
  if (occurrences.length !== 1) {
    throw new AppError("Text anchor quote must match exactly one location.", 422, occurrences.length === 0 ? "anchor_orphaned" : "anchor_ambiguous");
  }

  const occurrence = occurrences[0];
  const headingPath = Array.isArray(options.headingPath) ? options.headingPath : headingPathForLine(text, occurrence.lineStart);

  return {
    scope: "anchor",
    quote,
    headingPath,
    lineStart: occurrence.lineStart,
    lineEnd: occurrence.lineEnd,
    selectedHash: hashText(quote),
    fileHash: options.fileHash || hashText(text),
  };
}

export function resolveTextAnchor(text, anchor = {}) {
  if (anchor.scope === "global") {
    return { status: "resolved", strategy: "global" };
  }

  if (anchor.scope === "section") {
    const found = parseMarkdownOutline(text).find((heading) => sameHeadingPath(heading.headingPath, anchor.headingPath || []));
    return found
      ? { status: "resolved", strategy: "heading_path", lineStart: found.lineStart, lineEnd: found.lineStart }
      : { status: "orphaned", strategy: "heading_path" };
  }

  const quote = String(anchor.quote || "");
  if (!quote) {
    return { status: "orphaned", strategy: "missing_quote" };
  }

  if (anchor.lineStart && anchor.lineEnd) {
    const currentRangeText = lineTextForRange(text, anchor.lineStart, anchor.lineEnd);
    if (currentRangeText.includes(quote) && (!anchor.selectedHash || anchor.selectedHash === hashText(quote))) {
      return {
        status: "resolved",
        strategy: "line_range",
        lineStart: anchor.lineStart,
        lineEnd: anchor.lineEnd,
      };
    }
  }

  const occurrences = findQuoteOccurrences(text, quote);
  if (occurrences.length === 0) {
    return { status: "orphaned", strategy: "quote" };
  }

  const headingMatches = occurrences.filter((occurrence) => sameHeadingPath(headingPathForLine(text, occurrence.lineStart), anchor.headingPath || []));
  if (headingMatches.length === 1) {
    return {
      status: "resolved",
      strategy: "heading_quote",
      lineStart: headingMatches[0].lineStart,
      lineEnd: headingMatches[0].lineEnd,
    };
  }
  if (headingMatches.length > 1) {
    return { status: "ambiguous", strategy: "heading_quote" };
  }

  if (occurrences.length === 1) {
    return {
      status: "resolved",
      strategy: "quote",
      lineStart: occurrences[0].lineStart,
      lineEnd: occurrences[0].lineEnd,
    };
  }

  return { status: "ambiguous", strategy: "quote" };
}

async function readTextTarget(filePath) {
  const buffer = await fs.readFile(filePath);
  if (!isKnownTextExtension(filePath) && looksBinary(buffer)) {
    throw new AppError("Attached file must be a text file.", 422, "invalid_target");
  }
  if (looksBinary(buffer)) {
    throw new AppError("Attached file must be a text file.", 422, "invalid_target");
  }

  const text = buffer.toString("utf8");
  if (text.includes("\uFFFD")) {
    throw new AppError("Attached file must be valid UTF-8 text.", 422, "invalid_target");
  }

  return { buffer, text };
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function findRepoRoot(startPath) {
  let current = path.dirname(path.resolve(startPath));

  while (true) {
    const gitPath = path.join(current, ".git");
    if (await pathExists(gitPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function resolveGitDir(repoRoot) {
  const gitPath = path.join(repoRoot, ".git");
  const stat = await fs.stat(gitPath);
  if (stat.isDirectory()) {
    return gitPath;
  }

  const content = await fs.readFile(gitPath, "utf8");
  const match = content.match(/^gitdir:\s*(.+)\s*$/i);
  if (!match) {
    return null;
  }

  return path.resolve(repoRoot, match[1]);
}

async function readGitHead(repoRoot) {
  if (!repoRoot) {
    return "";
  }

  try {
    const gitDir = await resolveGitDir(repoRoot);
    if (!gitDir) {
      return "";
    }

    const head = (await fs.readFile(path.join(gitDir, "HEAD"), "utf8")).trim();
    if (!head.startsWith("ref:")) {
      return head;
    }

    const refPath = head.slice("ref:".length).trim();
    return (await fs.readFile(path.join(gitDir, refPath), "utf8")).trim();
  } catch {
    return "";
  }
}

function normalizeRepoRelativePath(repoRoot, targetPath) {
  if (!repoRoot) {
    return "";
  }
  return normalizeSlashes(path.relative(repoRoot, targetPath));
}

function makeSessionPaths(minimapHome, sessionId) {
  const sessionDir = path.join(minimapHome, "sessions", sessionId);
  return {
    sessionDir,
    sessionJson: path.join(sessionDir, "session.json"),
    commentsJsonl: path.join(sessionDir, "comments.jsonl"),
    suggestionsJsonl: path.join(sessionDir, "suggestions.jsonl"),
    eventsJsonl: path.join(sessionDir, "events.jsonl"),
  };
}

async function readJson(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readJsonLines(filePath) {
  const content = await fs.readFile(filePath, "utf8").catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  });

  return content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .map((line) => JSON.parse(line));
}

async function appendJsonLine(filePath, value) {
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

async function writeJsonLines(filePath, values) {
  const content = values.map((value) => JSON.stringify(value)).join("\n");
  await fs.writeFile(filePath, content ? `${content}\n` : "", "utf8");
}

function nextCommentId(comments) {
  return `cmt_${String(comments.length + 1).padStart(6, "0")}`;
}

function nextReplyId(comment) {
  const replies = Array.isArray(comment.replies) ? comment.replies : [];
  return `rpl_${String(replies.length + 1).padStart(6, "0")}`;
}

function requireNonEmptyString(value, message) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError(message, 400, "bad_request");
  }
  return value.trim();
}

function validateCommentKind(kind) {
  const normalized = requireNonEmptyString(kind, "Comment kind is required.");
  if (!COMMENT_KINDS.has(normalized)) {
    throw new AppError(`Unsupported comment kind: ${normalized}`, 400, "bad_request");
  }
  return normalized;
}

function validateCommentStatus(status) {
  const normalized = requireNonEmptyString(status, "Comment status is required.");
  if (!COMMENT_STATUSES.has(normalized)) {
    throw new AppError(`Unsupported comment status: ${normalized}`, 400, "bad_request");
  }
  return normalized;
}

function makeCommentAnchor(text, input) {
  const scope = typeof input.scope === "string" && input.scope.trim() ? input.scope.trim() : "";
  if (scope === "global") {
    return { scope: "global" };
  }

  if (scope === "section") {
    if (!Array.isArray(input.headingPath) || input.headingPath.length === 0 || input.headingPath.some((part) => typeof part !== "string" || part.trim() === "")) {
      throw new AppError("Section comments require a headingPath.", 400, "bad_request");
    }
    const anchor = {
      scope: "section",
      headingPath: input.headingPath.map((part) => part.trim()),
    };
    const resolved = resolveTextAnchor(text, anchor);
    if (resolved.status !== "resolved") {
      throw new AppError("Section anchor could not be resolved.", 422, "anchor_orphaned");
    }
    return anchor;
  }

  const quote = typeof input.quote === "string" ? input.quote : "";
  if (quote.trim() !== "") {
    return createTextAnchor(text, {
      quote,
      headingPath: Array.isArray(input.headingPath) ? input.headingPath : undefined,
    });
  }

  throw new AppError("Comments require scope=global, scope=section with headingPath, or quote.", 400, "bad_request");
}

function withAnchorStatus(comment, text) {
  return {
    ...comment,
    anchorStatus: resolveTextAnchor(text, comment.anchor),
  };
}

async function loadCommentState(filePath, options) {
  const session = await getFileSession(filePath, options);
  const minimapHome = options.minimapHome || resolveMinimapHome(options.env || process.env, options.platform || process.platform);
  const paths = makeSessionPaths(minimapHome, session.id);
  await ensureSessionFiles(paths);
  const targetPath = path.resolve(session.targetFile);
  const { text } = await readTextTarget(targetPath);
  const comments = await readJsonLines(paths.commentsJsonl);
  return { session, paths, text, comments };
}

function findCommentIndex(comments, commentId) {
  return comments.findIndex((comment) => comment.id === commentId);
}

async function saveCommentMutation(paths, session, comments, timestamp) {
  await writeJsonLines(paths.commentsJsonl, comments);
  await writeJson(paths.sessionJson, {
    ...session,
    lastActiveAt: timestamp,
  });
}

export function resolveMinimapHome(env = process.env, platform = process.platform) {
  if (env.MINIMAP_HOME && env.MINIMAP_HOME.trim()) {
    return path.resolve(env.MINIMAP_HOME);
  }

  if (platform === "win32") {
    const localAppData = env.LOCALAPPDATA && env.LOCALAPPDATA.trim()
      ? env.LOCALAPPDATA
      : path.join(os.homedir(), "AppData", "Local");
    return path.join(localAppData, "minimap");
  }

  return path.join(os.homedir(), ".minimap");
}

export async function loadSessionIndex(minimapHome = resolveMinimapHome()) {
  const indexPath = path.join(minimapHome, SESSION_INDEX_FILE);
  const index = await readJson(indexPath, { version: SESSION_INDEX_VERSION, files: {} });
  return {
    version: SESSION_INDEX_VERSION,
    files: index?.files && typeof index.files === "object" && !Array.isArray(index.files) ? index.files : {},
  };
}

async function saveSessionIndex(minimapHome, index) {
  await fs.mkdir(minimapHome, { recursive: true });
  await writeJson(path.join(minimapHome, SESSION_INDEX_FILE), {
    version: SESSION_INDEX_VERSION,
    files: index.files || {},
  });
}

async function ensureSessionFiles(paths) {
  await fs.mkdir(paths.sessionDir, { recursive: true });
  for (const filePath of [paths.commentsJsonl, paths.suggestionsJsonl, paths.eventsJsonl]) {
    if (!(await pathExists(filePath))) {
      await fs.writeFile(filePath, EMPTY_JSONL, "utf8");
    }
  }
}

async function readValidTarget(targetPath, sourcePathForMessage) {
  const stat = await fs.stat(targetPath).catch((error) => {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new AppError(`Attached file was not found: ${sourcePathForMessage}`, 404, "not_found");
    }
    throw error;
  });

  if (!stat.isFile()) {
    throw new AppError("Attached target must be a file.", 422, "invalid_target");
  }

  return readTextTarget(targetPath);
}

async function buildTargetMetadata(targetPath, contentBuffer) {
  const repoRoot = await findRepoRoot(targetPath);
  const fileKind = detectFileKind(targetPath);
  return {
    targetFile: normalizeDisplayPath(targetPath),
    title: path.basename(targetPath),
    repoRoot: repoRoot ? normalizeDisplayPath(repoRoot) : "",
    relativePath: repoRoot ? normalizeRepoRelativePath(repoRoot, targetPath) : "",
    contentHash: hashContent(contentBuffer),
    gitHead: await readGitHead(repoRoot),
    fileKind: fileKind.kind,
    markdown: fileKind.markdown,
  };
}

export async function attachFileSession(filePath, options = {}) {
  const cwd = options.cwd || process.cwd();
  const minimapHome = options.minimapHome || resolveMinimapHome(options.env || process.env, options.platform || process.platform);
  const targetPath = path.resolve(cwd, filePath);
  const { buffer } = await readValidTarget(targetPath, filePath);
  const fileKey = normalizeFileKey(targetPath, options.platform || process.platform);
  const index = await loadSessionIndex(minimapHome);
  const existingSessionId = index.files[fileKey];
  const sessionId = existingSessionId || makeSessionId(fileKey, targetPath);
  const paths = makeSessionPaths(minimapHome, sessionId);
  const existing = existingSessionId ? await readJson(paths.sessionJson, null) : null;
  const timestamp = nowIso();
  const metadata = await buildTargetMetadata(targetPath, buffer);
  const session = {
    id: sessionId,
    createdAt: existing?.createdAt || timestamp,
    lastActiveAt: timestamp,
    ...metadata,
  };

  await ensureSessionFiles(paths);
  await writeJson(paths.sessionJson, session);

  if (!existingSessionId) {
    index.files[fileKey] = sessionId;
    await saveSessionIndex(minimapHome, index);
  }

  return {
    created: !existingSessionId,
    session,
  };
}

export async function moveFileSession(fromFilePath, toFilePath, options = {}) {
  const cwd = options.cwd || process.cwd();
  const platform = options.platform || process.platform;
  const minimapHome = options.minimapHome || resolveMinimapHome(options.env || process.env, platform);
  const fromTargetPath = path.resolve(cwd, fromFilePath);
  const toTargetPath = path.resolve(cwd, toFilePath);
  const fromFileKey = normalizeFileKey(fromTargetPath, platform);
  const toFileKey = normalizeFileKey(toTargetPath, platform);
  const index = await loadSessionIndex(minimapHome);
  const sessionId = index.files[fromFileKey];

  if (!sessionId) {
    throw new AppError(`No minimap session is attached for ${fromFilePath}. Run: minimap attach ${fromFilePath}`, 404, "not_found");
  }

  const conflictingSessionId = index.files[toFileKey];
  if (conflictingSessionId && conflictingSessionId !== sessionId) {
    throw new AppError(`A different minimap session is already attached for ${toFilePath}.`, 409, "conflict");
  }

  const { buffer } = await readValidTarget(toTargetPath, toFilePath);
  const paths = makeSessionPaths(minimapHome, sessionId);
  const existing = await readJson(paths.sessionJson, null);

  if (!existing) {
    throw new AppError(`Session metadata is missing for ${fromFilePath}.`, 404, "not_found");
  }

  const session = {
    ...existing,
    lastActiveAt: nowIso(),
    ...(await buildTargetMetadata(toTargetPath, buffer)),
  };

  await ensureSessionFiles(paths);
  await writeJson(paths.sessionJson, session);

  if (fromFileKey !== toFileKey) {
    delete index.files[fromFileKey];
  }
  index.files[toFileKey] = sessionId;
  await saveSessionIndex(minimapHome, index);

  return { session };
}

export async function getFileSession(filePath, options = {}) {
  const cwd = options.cwd || process.cwd();
  const minimapHome = options.minimapHome || resolveMinimapHome(options.env || process.env, options.platform || process.platform);
  const targetPath = path.resolve(cwd, filePath);
  const fileKey = normalizeFileKey(targetPath, options.platform || process.platform);
  const index = await loadSessionIndex(minimapHome);
  const sessionId = index.files[fileKey];

  if (!sessionId) {
    throw new AppError(`No minimap session is attached for ${filePath}. Run: minimap attach ${filePath}`, 404, "not_found");
  }

  const paths = makeSessionPaths(minimapHome, sessionId);
  const session = await readJson(paths.sessionJson, null);
  if (!session) {
    throw new AppError(`Session metadata is missing for ${filePath}.`, 404, "not_found");
  }

  return session;
}

export async function addFileSessionComment(filePath, input = {}, options = {}) {
  const { session, paths, text, comments } = await loadCommentState(filePath, options);
  const timestamp = nowIso();
  const comment = {
    id: nextCommentId(comments),
    by: requireNonEmptyString(input.by, "Comment actor is required."),
    kind: validateCommentKind(input.kind),
    status: "open",
    anchor: makeCommentAnchor(text, input),
    text: requireNonEmptyString(input.text, "Comment text is required."),
    confidence: typeof input.confidence === "string" && input.confidence.trim() ? input.confidence.trim() : "",
    createdAt: timestamp,
    updatedAt: timestamp,
    replies: [],
  };

  await appendJsonLine(paths.commentsJsonl, comment);
  await writeJson(paths.sessionJson, {
    ...session,
    lastActiveAt: timestamp,
  });

  return {
    comment: withAnchorStatus(comment, text),
  };
}

export async function addFileSessionCommentReply(filePath, commentId, input = {}, options = {}) {
  const { session, paths, text, comments } = await loadCommentState(filePath, options);
  const index = findCommentIndex(comments, commentId);

  if (index === -1) {
    throw new AppError(`Comment was not found: ${commentId}`, 404, "not_found");
  }

  const timestamp = nowIso();
  const comment = {
    ...comments[index],
    replies: Array.isArray(comments[index].replies) ? [...comments[index].replies] : [],
    updatedAt: timestamp,
  };
  comment.replies.push({
    id: nextReplyId(comment),
    by: requireNonEmptyString(input.by, "Reply actor is required."),
    text: requireNonEmptyString(input.text, "Reply text is required."),
    createdAt: timestamp,
  });
  comments[index] = comment;

  await saveCommentMutation(paths, session, comments, timestamp);

  return {
    comment: withAnchorStatus(comment, text),
  };
}

export async function updateFileSessionCommentStatus(filePath, commentId, status, input = {}, options = {}) {
  const { session, paths, text, comments } = await loadCommentState(filePath, options);
  const index = findCommentIndex(comments, commentId);

  if (index === -1) {
    throw new AppError(`Comment was not found: ${commentId}`, 404, "not_found");
  }

  const timestamp = nowIso();
  const comment = {
    ...comments[index],
    status: validateCommentStatus(status),
    statusBy: requireNonEmptyString(input.by, "Status actor is required."),
    updatedAt: timestamp,
  };
  comments[index] = comment;

  await saveCommentMutation(paths, session, comments, timestamp);

  return {
    comment: withAnchorStatus(comment, text),
  };
}

export async function getFileSessionContext(filePath, options = {}) {
  const session = await getFileSession(filePath, options);
  const minimapHome = options.minimapHome || resolveMinimapHome(options.env || process.env, options.platform || process.platform);
  const paths = makeSessionPaths(minimapHome, session.id);
  const targetPath = path.resolve(session.targetFile);
  const { buffer, text } = await readTextTarget(targetPath);
  const currentMetadata = await buildTargetMetadata(targetPath, buffer);
  const comments = (await readJsonLines(paths.commentsJsonl)).map((comment) => withAnchorStatus(comment, text));

  return {
    session: {
      ...session,
      ...currentMetadata,
    },
    outline: currentMetadata.markdown ? parseMarkdownOutline(text) : [],
    comments,
    suggestions: [],
  };
}

export async function getFileSessionFileContent(filePath, options = {}) {
  const context = await getFileSessionContext(filePath, options);
  const targetPath = path.resolve(context.session.targetFile);
  const { text } = await readTextTarget(targetPath);

  return {
    session: context.session,
    outline: context.outline,
    content: text,
  };
}

export async function listFileSessions(options = {}) {
  const minimapHome = options.minimapHome || resolveMinimapHome(options.env || process.env, options.platform || process.platform);
  const index = await loadSessionIndex(minimapHome);
  const sessions = [];

  for (const sessionId of Object.values(index.files)) {
    const paths = makeSessionPaths(minimapHome, sessionId);
    const session = await readJson(paths.sessionJson, null);
    if (session) {
      sessions.push(session);
    }
  }

  return sessions.sort((left, right) => String(right.lastActiveAt || "").localeCompare(String(left.lastActiveAt || "")));
}
