import { mkdir, writeTextFile, readTextFile, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import type { Shape, ShapeJSON } from './shapes';

const PROJECTS_DIR = 'VectorEngine/projects';
const INDEX_FILE = 'VectorEngine/projects/index.json';
const LS_PREFIX = 'vectorengine_';

export interface ProjectIndexEntry {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  lineAlgorithm: 'bresenham' | 'wu';
  shapes: ShapeJSON[];
}

/** Detect if the app is running inside the Tauri webview */
export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
}

/* ---------- Unified storage backend (Tauri fs -> localStorage fallback) ---------- */

async function ensureDir(): Promise<void> {
  if (!isTauriAvailable()) return;
  try {
    await mkdir(PROJECTS_DIR, { baseDir: BaseDirectory.Document, recursive: true });
  } catch { /* ignore */ }
}

function lsKey(path: string): string {
  return LS_PREFIX + path.replace(/\//g, '_');
}

async function writeFile(path: string, content: string): Promise<void> {
  if (isTauriAvailable()) {
    await writeTextFile(path, content, { baseDir: BaseDirectory.Document });
  } else {
    localStorage.setItem(lsKey(path), content);
  }
}

async function readFile(path: string): Promise<string> {
  if (isTauriAvailable()) {
    return await readTextFile(path, { baseDir: BaseDirectory.Document });
  }
  const v = localStorage.getItem(lsKey(path));
  if (v === null) throw new Error('ENOENT');
  return v;
}

async function fileExists(path: string): Promise<boolean> {
  if (isTauriAvailable()) {
    return await exists(path, { baseDir: BaseDirectory.Document });
  }
  return localStorage.getItem(lsKey(path)) !== null;
}

/* ---------- Public API ---------- */

export async function loadProjectIndex(): Promise<ProjectIndexEntry[]> {
  try {
    const text = await readFile(INDEX_FILE);
    return JSON.parse(text) as ProjectIndexEntry[];
  } catch {
    return [];
  }
}

async function saveProjectIndex(index: ProjectIndexEntry[]): Promise<void> {
  await ensureDir();
  await writeFile(INDEX_FILE, JSON.stringify(index, null, 2));
}

export async function saveProject(
  id: string,
  name: string,
  lineAlgorithm: 'bresenham' | 'wu',
  shapes: Shape[]
): Promise<void> {
  await ensureDir();

  const now = new Date().toISOString();
  const index = await loadProjectIndex();
  const existing = index.find((p) => p.id === id);

  if (existing) {
    existing.name = name;
    existing.updatedAt = now;
  } else {
    index.push({
      id,
      name,
      createdAt: now,
      updatedAt: now,
    });
  }

  await saveProjectIndex(index);

  const projectData: ProjectData = {
    id,
    name,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lineAlgorithm,
    shapes: shapes.map((s) => s.toJSON()),
  };

  const filePath = `${PROJECTS_DIR}/${id}.json`;
  await writeFile(filePath, JSON.stringify(projectData, null, 2));
}

export async function loadProject(id: string): Promise<ProjectData | null> {
  const filePath = `${PROJECTS_DIR}/${id}.json`;
  try {
    const text = await readFile(filePath);
    return JSON.parse(text) as ProjectData;
  } catch {
    return null;
  }
}

export async function projectExists(id: string): Promise<boolean> {
  const filePath = `${PROJECTS_DIR}/${id}.json`;
  return await fileExists(filePath);
}
