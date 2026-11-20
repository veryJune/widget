// 프로젝트(또는 선택한 카드)를 사람이 쓰기 좋은 파일 모음(.zip)으로
//   {프로젝트}/
//     images/   001_이름.webp …   올린 이미지 · 캡처한 장면 (저장된 보기용 원본)
//     memos/    001_글머리.txt …  메모 카드
//     videos/   001_이름.mp4 …    직접 파일 주소의 영상 중 내려받을 수 있는 것만
//     links.csv                   링크 · 영상 · 임베드 목록 (엑셀에서 열림)
//     board.md                    섹션별로 정리한 보드 전체 (메모 · 링크 포함)
//     index.json                  모든 카드의 정보(순서 · 섹션 · 분류 · 별점 · 메모 · 파일 위치)
//     README.txt                  담은 것과 건너뛴 것(이유 포함)
// 이 파일은 사람이 쓰는 내보내기입니다. 다시 불러오기(복원)용은 '백업 .zip'(lib/backup.ts) 을 쓰세요.
import { strToU8, zipSync } from 'fflate';
import type { Item, Project } from '../types';
import { categoryOf, CATEGORY_LABEL, type Category } from './categories';
import { embedBadge } from './providers';
import { fileExt, isUrl } from './util';
import { fmtStart, parseVideo } from './video';

export interface ExportOptions {
  images: boolean;
  memos: boolean;
  /** 링크 · 영상 · 임베드 목록(links.csv) */
  links: boolean;
  /** 직접 파일 주소(.mp4 등)의 영상 — 서버가 허용할 때만 받아짐 */
  videos: boolean;
}

export interface ExportEntry {
  item: Item;
  /** 소속 섹션 이름 (맨 위 묶음은 '') */
  section: string;
  /** 보드에서의 순서(1부터) */
  order: number;
}

export interface ExportReport {
  images: number;
  memos: number;
  links: number;
  videos: number;
  skipped: { name: string; reason: string }[];
}

// ---------- 이름 · CSV 도구 (순수 함수) ----------

/** 파일/폴더 이름으로 못 쓰는 글자를 정리 (Windows · macOS 공통) */
export function sanitizeName(s: string, max = 80): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, max)
    .trim();
}

export function stripExt(name: string): string {
  return name.replace(/\.[A-Za-z0-9]{1,5}$/, '');
}

/** 같은 이름이 있으면 '_2', '_3' … 을 확장자 앞에 붙임 (대소문자 구분 없이) */
export function uniqueName(used: Set<string>, name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let candidate = name;
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base}_${n}${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}

export function csvEscape(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** 엑셀에서 한글이 깨지지 않도록 BOM 을 붙인 CSV */
export function toCsv(rows: string[][]): string {
  return '﻿' + rows.map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n';
}

const pad = (n: number, total: number) => String(n).padStart(Math.max(3, String(total).length), '0');

/** 이미지 파일 이름의 본문: 올린 파일 이름 + (캡처한 장면이면) 타임코드 */
export function imageBase(it: Item): string {
  const parts: string[] = [];
  if (it.content && !isUrl(it.content)) parts.push(stripExt(it.content));
  if (it.title) parts.push(it.title.replace(/[:.]/g, '-'));
  return sanitizeName(parts.join('_')) || 'image';
}

/** 단일 이미지 내려받기용 파일 이름 (확장자 포함) */
export function imageFileName(it: Item): string {
  return `${imageBase(it)}.${fileExt(it.path ?? '', '')}`;
}

function memoBase(it: Item): string {
  return sanitizeName(it.content.split(/\r?\n/)[0].slice(0, 40)) || 'memo';
}

function videoNameFromUrl(url: string): { base: string; ext: string } {
  try {
    const seg = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'video');
    const m = /^(.*?)(?:\.([A-Za-z0-9]{2,5}))?$/.exec(seg);
    return { base: sanitizeName(m?.[1] || 'video') || 'video', ext: (m?.[2] || 'mp4').toLowerCase() };
  } catch {
    return { base: 'video', ext: 'mp4' };
  }
}

/** 보드 순서대로 카드를 모으고 소속 섹션을 붙임. pickIds 가 있으면 그 카드만 (섹션 이름은 전체 목록 기준) */
export function entriesOf(allOrdered: Item[], pickIds: Set<string> | null): ExportEntry[] {
  const out: ExportEntry[] = [];
  let section = '';
  let order = 0;
  for (const it of allOrdered) {
    if (it.deleted_at) continue;
    if (it.type === 'divider') {
      section = it.content;
      continue;
    }
    order++;
    if (pickIds && !pickIds.has(it.id)) continue;
    out.push({ item: it, section, order });
  }
  return out;
}

/** 범위 안에 무엇이 몇 개 있는지 (내려받기 창의 숫자) */
export function summarize(entries: ExportEntry[]): { images: number; memos: number; links: number; videoFiles: number; total: number } {
  let images = 0;
  let memos = 0;
  let links = 0;
  let videoFiles = 0;
  for (const { item } of entries) {
    const c = categoryOf(item);
    if (c === 'image') images++;
    else if (c === 'text') memos++;
    else if (c) {
      links++;
      if (parseVideo(item.content)?.kind === 'file') videoFiles++;
    }
  }
  return { images, memos, links, videoFiles, total: entries.length };
}

// ---------- 만들기 ----------

export interface BuildArgs {
  project: Pick<Project, 'title'>;
  entries: ExportEntry[];
  opts: ExportOptions;
  getImage(path: string): Promise<Blob | null>;
  getVideo(url: string): Promise<{ blob: Blob } | { skip: string }>;
  onProgress?(done: number, total: number, label: string): void;
  signal?: AbortSignal;
  now?: Date;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('내려받기를 취소했습니다.', 'AbortError');
}

export async function buildExportZip(a: BuildArgs): Promise<{ zip: Uint8Array; report: ExportReport; rootName: string }> {
  const root = sanitizeName(a.project.title) || 'MoodGrid';
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 | 6 }]> = {};
  const report: ExportReport = { images: 0, memos: 0, links: 0, videos: 0, skipped: [] };
  const total = a.entries.length;
  const usedNames = { images: new Set<string>(), memos: new Set<string>(), videos: new Set<string>() };
  const counters = { images: 0, memos: 0, videos: 0 };
  const fileOf = new Map<string, string>(); // item.id → zip 안 경로(root 기준)

  const heavy = a.entries.filter((e) => (a.opts.images && e.item.type === 'image' && e.item.path) || (a.opts.videos && parseVideo(e.item.content)?.kind === 'file')).length;
  let done = 0;
  const tick = (label: string) => a.onProgress?.(++done, Math.max(heavy, 1), label);
  const text = (path: string, content: string) => {
    files[`${root}/${path}`] = [strToU8(content), { level: 6 }];
  };
  const binary = (path: string, data: Uint8Array) => {
    files[`${root}/${path}`] = [data, { level: 0 }];
  };

  for (const { item } of a.entries) {
    throwIfAborted(a.signal);
    const cat = categoryOf(item) as Category;

    if (cat === 'image' && a.opts.images && item.path) {
      const label = imageBase(item);
      const blob = await a.getImage(item.path);
      throwIfAborted(a.signal);
      if (!blob) {
        report.skipped.push({ name: label, reason: '이미지 파일을 불러오지 못함' });
      } else {
        counters.images++;
        const name = uniqueName(usedNames.images, `${pad(counters.images, total)}_${label}.${fileExt(item.path, blob.type)}`);
        binary(`images/${name}`, new Uint8Array(await blob.arrayBuffer()));
        fileOf.set(item.id, `images/${name}`);
        report.images++;
      }
      tick(label);
    } else if (cat === 'text' && a.opts.memos) {
      counters.memos++;
      const name = uniqueName(usedNames.memos, `${pad(counters.memos, total)}_${memoBase(item)}.txt`);
      text(`memos/${name}`, item.note ? `${item.content}\n\n---\n카드 메모: ${item.note}\n` : `${item.content}\n`);
      fileOf.set(item.id, `memos/${name}`);
      report.memos++;
    } else if (a.opts.videos && parseVideo(item.content)?.kind === 'file') {
      const v = parseVideo(item.content);
      const nm = videoNameFromUrl(v?.url ?? item.content);
      const label = `${nm.base}.${nm.ext}`;
      const r = await a.getVideo(v?.url ?? item.content);
      throwIfAborted(a.signal);
      if ('skip' in r) report.skipped.push({ name: label, reason: r.skip });
      else {
        counters.videos++;
        const name = uniqueName(usedNames.videos, `${pad(counters.videos, total)}_${label}`);
        binary(`videos/${name}`, new Uint8Array(await r.blob.arrayBuffer()));
        fileOf.set(item.id, `videos/${name}`);
        report.videos++;
      }
      tick(label);
    }
  }

  // ---- 목록 · 요약 ----
  const rows: string[][] = [['번호', '섹션', '분류', '제목', '주소', '임베드 주소', '시작 시간(초)', '별점', '카드 메모', '추가한 날', '내려받은 파일']];
  for (const { item, section, order } of a.entries) {
    const cat = categoryOf(item);
    if (!cat || cat === 'image' || cat === 'text') continue;
    const v = parseVideo(item.content);
    rows.push([String(order), section, CATEGORY_LABEL[cat], item.title, item.content, item.embed ?? '', v?.start ? String(v.start) : '', item.rating ? String(item.rating) : '', item.note, item.created_at.slice(0, 10), fileOf.get(item.id) ?? '']);
  }
  report.links = rows.length - 1;
  if (a.opts.links && report.links) text('links.csv', toCsv(rows));

  const md: string[] = [`# ${a.project.title}`, ''];
  let lastSection: string | null = null;
  for (const { item, section } of a.entries) {
    if (section !== lastSection) {
      md.push(section ? `## ${section}` : '## (분류 없음)', '');
      lastSection = section;
    }
    const cat = categoryOf(item);
    const star = item.rating ? ` ${'★'.repeat(item.rating)}` : '';
    const note = item.note ? ` — ${item.note.replace(/\r?\n/g, ' ')}` : '';
    const file = fileOf.get(item.id);
    if (cat === 'image') md.push(`- 이미지: ${file ? `[${file.split('/').pop()}](${encodeURI(file)})` : imageBase(item)}${item.title ? ` (${item.title})` : ''}${star}${note}`);
    else if (cat === 'text') md.push(...item.content.split(/\r?\n/).map((l) => `> ${l}`), ...(item.note || star ? [`> ${star.trim()}${note}`.trimEnd()] : []), '');
    else if (cat === 'video' || cat === 'link' || cat === 'embed') {
      const v = parseVideo(item.content);
      const label = item.title || item.content;
      const extra = v?.start ? ` (${fmtStart(v.start)}부터)` : cat === 'embed' || (cat === 'video' && item.embed) ? ` (${embedBadge(item.embed)})` : '';
      md.push(`- ${CATEGORY_LABEL[cat]}: [${label.replace(/[[\]]/g, '')}](${item.content})${extra}${star}${note}`);
    }
  }
  text('board.md', md.join('\n') + '\n');

  const index = a.entries.map(({ item, section, order }) => ({
    order,
    section,
    category: categoryOf(item),
    type: item.type,
    title: item.title,
    content: item.content,
    embed: item.embed,
    note: item.note,
    rating: item.rating,
    pinned: item.pinned,
    colors: item.colors,
    created_at: item.created_at,
    file: fileOf.get(item.id) ?? null,
  }));
  text('index.json', JSON.stringify({ app: 'moodgrid', project: a.project.title, exported_at: (a.now ?? new Date()).toISOString(), items: index }, null, 2));

  const lines = [
    `MoodGrid 내려받기 — ${a.project.title}`,
    `만든 날: ${(a.now ?? new Date()).toISOString().slice(0, 10)}`,
    '',
    `담은 것: 이미지 ${report.images} · 메모 ${report.memos} · 영상 파일 ${report.videos} · 링크/영상/임베드 목록 ${a.opts.links ? report.links : 0}`,
    '',
    'YouTube · Vimeo 같은 스트리밍 영상과 각종 임베드는 파일을 받을 수 없어 links.csv 의 주소로 남깁니다.',
    '이 파일 모음은 보기·정리용입니다. 다시 불러오기(복원)에는 MoodGrid 의 "백업" 파일을 쓰세요.',
  ];
  if (report.skipped.length) lines.push('', `건너뛴 것 (${report.skipped.length}):`, ...report.skipped.map((s) => `- ${s.name}: ${s.reason}`));
  text('README.txt', lines.join('\n') + '\n');

  return { zip: zipSync(files as Parameters<typeof zipSync>[0]), report, rootName: root };
}
