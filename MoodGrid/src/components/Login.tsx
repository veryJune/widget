// 로그인 (Supabase 연결 시에만 보임). 회원가입은 없음 — StealBook 과 같은 내 계정 하나로만 들어옵니다.
import { useState } from 'react';
import { Loader2, LayoutGrid } from 'lucide-react';
import { useStore } from '../store';
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
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-bg">
            <LayoutGrid size={24} />
          </div>
          <h1 className="text-[28px] font-bold tracking-tight">MoodGrid</h1>
          <p className="mt-2 text-[15px] text-mute">나만의 무드보드. 로그인하면 어디서든 이어서 작업할 수 있어요.</p>
        </div>
        <div className="space-y-4">
          <Field label="이메일">
            <input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-autofocus />
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
