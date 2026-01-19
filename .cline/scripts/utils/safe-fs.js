import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

/**
 * Safe FS Utility
 * Provides atomic file operations with locking and strict local scoping
 */

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 100;
const LOCK_STALE_MS = 5000;

// Ensure we only operate within the project root
const PROJECT_ROOT = process.cwd();

/**
 * Validate path is within project root
 */
export function validatePath(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!absolutePath.startsWith(PROJECT_ROOT)) {
    throw new Error(
      `Security Violation: Path ${filePath} is outside project root ${PROJECT_ROOT}`
    );
  }
  return absolutePath;
}

/**
 * Sleep helper
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Acquire lock for a file
 */
function acquireLock(lockFile) {
  try {
    // Check if lock exists and is stale
    if (fs.existsSync(lockFile)) {
      const stats = fs.statSync(lockFile);
      const age = Date.now() - stats.mtimeMs;
      if (age > LOCK_STALE_MS) {
        fs.unlinkSync(lockFile); // Remove stale lock
      } else {
        return false; // Lock active
      }
    }

    // Create lock file (inclusive flag fails if file exists)
    fs.writeFileSync(lockFile, process.pid.toString(), { flag: 'wx' });
    return true;
  } catch (error) {
    return false; // Failed to acquire
  }
}

/**
 * Safe write JSON with locking
 */
export async function writeJsonSafe(filePath, data) {
  const validPath = validatePath(filePath);
  const lockFile = `${validPath}.lock`;
  let retries = 0;

  while (retries < MAX_RETRIES) {
    if (acquireLock(lockFile)) {
      try {
        // Atomic write via temp file
        const tempFile = `${validPath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
        fs.renameSync(tempFile, validPath);
        return true;
      } finally {
        try {
          fs.unlinkSync(lockFile);
        } catch (e) {}
      }
    }

    await sleep(RETRY_DELAY_MS);
    retries++;
  }

  throw new Error(
    `Failed to acquire lock for ${filePath} after ${MAX_RETRIES} retries`
  );
}

/**
 * Safe read JSON
 */
export async function readJsonSafe(filePath) {
  const validPath = validatePath(filePath);
  if (!fs.existsSync(validPath)) return null;

  try {
    const data = fs.readFileSync(validPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // If syntax error (partial write), wait and retry once
    await sleep(RETRY_DELAY_MS);
    try {
      const retryData = fs.readFileSync(validPath, 'utf8');
      return JSON.parse(retryData);
    } catch (retryError) {
      throw new Error(
        `Failed to read/parse ${filePath}: ${retryError.message}`
      );
    }
  }
}

/**
 * Safe append to log file (no locking needed for append-only usually, but we validate path)
 */
export function appendLogSafe(filePath, line) {
  const validPath = validatePath(filePath);
  const dir = path.dirname(validPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(validPath, line + '\n');
}
