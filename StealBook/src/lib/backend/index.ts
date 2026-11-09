// 환경변수가 있으면 Supabase(동기화), 없으면 체험 모드(이 기기에만 저장)
import { createLocalBackend } from './local';
import { createSupabaseBackend } from './supabase';
import type { Backend } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_KEY as string | undefined;

export const backend: Backend = url && key ? createSupabaseBackend(url, key) : createLocalBackend();

export type { Backend, Session } from './types';
