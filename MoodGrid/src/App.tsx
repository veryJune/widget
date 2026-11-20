import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { backend } from './lib/backend';
import { useStore } from './store';
import { useInput } from './hooks/useInput';
import { Board } from './components/Board';
import { Editor } from './components/Editor';
import { Header } from './components/Header';
import { ItemTrash } from './components/ItemTrash';
import { Help } from './components/Help';
import { Lightbox } from './components/Lightbox';
import { Login } from './components/Login';
import { SelectionBar } from './components/SelectionBar';
import { VideoModal } from './components/VideoModal';
import { AskDialog, Toasts } from './components/Toasts';

export default function App() {
  const booting = useStore((s) => s.booting);
  const session = useStore((s) => s.session);
  useInput();

  useEffect(() => {
    void useStore.getState().boot();
  }, []);

  if (booting) {
    return (
      <div className="flex h-full items-center justify-center text-mute" role="status" aria-label="불러오는 중">
        <Loader2 className="animate-spin" size={24} />
      </div>
    );
  }
  if (backend.mode === 'cloud' && !session) return <Login />;

  return (
    <div className="flex h-full flex-col">
      <Header />
      <main className="min-h-0 flex-1 overflow-y-auto scroll-thin" id="scroll-root">
        <Board />
      </main>
      <SelectionBar />
      <Editor />
      <Lightbox />
      <VideoModal />
      <Help />
      <ItemTrash />
      <AskDialog />
      <Toasts />
    </div>
  );
}
