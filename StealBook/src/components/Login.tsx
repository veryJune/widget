// 로그인 (Supabase 연결 시에만 보임). 회원가입은 없음 — Supabase 대시보드에서 만든 내 계정 하나로만 들어옵니다.
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { Wordmark } from './Scribble';
import { Button, Field, inputCls } from './ui';

export function Login() {
  const signIn = useStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <main className="flex min-h-full items-center justify-center px-6 py-16">
      <form
        className="w-full max-w-[360px]"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await signIn(email.trim(), password);
          } catch (err) {
            setError((err as Error).message || '로그인하지 못했습니다.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="mb-10">
          <Wordmark size={40} animate />
          <p className="mt-5 text-[15px] text-mute">훔치고 싶은 것들을 모아 두는 나만의 책.</p>
        </div>
        <div className="space-y-4">
          <Field label="이메일">
            <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="비밀번호">
            <input className={inputCls} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          {error && (
            <p role="alert" className="text-[14px] text-[#e5534b]">
              {error}
            </p>
          )}
          <Button variant="primary" type="submit" disabled={busy} className="h-11 w-full">
            {busy ? <Loader2 size={16} className="animate-spin" /> : null} 로그인
          </Button>
        </div>
      </form>
    </main>
  );
}
