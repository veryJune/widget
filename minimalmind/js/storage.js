/* ============================================================
 * MinimalMind — Storage abstraction
 *
 * 앱은 오직 StorageProvider 인터페이스에만 의존한다.
 *   load()        -> 정규화된 문서 또는 null
 *   save(doc)     -> { ok:boolean, error? }
 *
 * 2단계에서 LocalStorageProvider 를 CloudProvider(단일 비밀번호 +
 * 서버측 검증)로 교체하거나, 로컬을 source-of-truth 로 두고 그 위에
 * 디바운스 동기화 계층만 얹으면 된다. 앱/렌더 코드는 변경 불필요.
 * ============================================================ */
window.MM = window.MM || {};

/* ------------------------------------------------------------
 * ProjectStore — 다중 프로젝트 (로컬)
 *   인덱스:  minimalMind_projects_v1  → [{id,title,createdAt,updatedAt}]
 *   문서:    minimalMind_doc_<id>     → 정규화된 문서
 *   활성:    minimalMind_active_v1    → 활성 프로젝트 id
 *   기존 단일 문서(minimalMind_v7)는 첫 실행 시 자동 이전.
 *
 * 2단계 클라우드 단계에서는 이 클래스의 read/write 만 원격 호출로
 * 바꾸면 되며(동일 인터페이스), 앱/렌더 코드는 변경 불필요.
 * ---------------------------------------------------------- */
MM.ProjectStore = class {
    constructor() {
        this.INDEX_KEY = 'minimalMind_projects_v1';
        this.ACTIVE_KEY = 'minimalMind_active_v1';
        this.DOC_PREFIX = 'minimalMind_doc_';
        this.LEGACY_KEY = 'minimalMind_v7';
    }

    _read(key) {
        try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
        catch (e) { return null; }
    }
    _write(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); return { ok: true }; }
        catch (e) {
            const quota = e && (e.name === 'QuotaExceededError' || e.code === 22);
            return { ok: false, error: e, reason: quota ? 'quota' : 'unknown' };
        }
    }

    newId() { return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

    listProjects() { const idx = this._read(this.INDEX_KEY); return Array.isArray(idx) ? idx : []; }
    _writeIndex(list) { return this._write(this.INDEX_KEY, list); }

    getActiveId() { return this._read(this.ACTIVE_KEY); }
    setActiveId(id) { this._write(this.ACTIVE_KEY, id); }

    loadProject(id) {
        const raw = this._read(this.DOC_PREFIX + id);
        return raw ? MM.Security.sanitizeDocument(raw) : null;
    }

    saveProject(id, doc, title) {
        const res = this._write(this.DOC_PREFIX + id, doc);
        if (!res.ok) return res;
        const list = this.listProjects();
        const now = Date.now();
        const i = list.findIndex(p => p.id === id);
        if (i >= 0) { list[i].title = title; list[i].updatedAt = now; }
        else { list.push({ id, title, createdAt: now, updatedAt: now }); }
        list.sort((a, b) => b.updatedAt - a.updatedAt);
        this._writeIndex(list);
        return { ok: true };
    }

    createProject(doc, title) {
        const id = this.newId();
        const res = this.saveProject(id, doc, title);
        if (res.ok) { this.setActiveId(id); return id; }
        return null;
    }

    renameProject(id, title) {
        const list = this.listProjects();
        const p = list.find(x => x.id === id);
        if (p) { p.title = title; p.updatedAt = Date.now(); list.sort((a, b) => b.updatedAt - a.updatedAt); this._writeIndex(list); }
        const doc = this.loadProject(id);
        if (doc) { doc.docTitle = title; this._write(this.DOC_PREFIX + id, doc); }
    }

    deleteProject(id) {
        try { localStorage.removeItem(this.DOC_PREFIX + id); } catch (e) { /* ignore */ }
        const list = this.listProjects().filter(p => p.id !== id);
        this._writeIndex(list);
        if (this.getActiveId() === id) this.setActiveId(list.length ? list[0].id : null);
        return list;
    }

    duplicateProject(id) {
        const doc = this.loadProject(id);
        if (!doc) return null;
        const src = this.listProjects().find(p => p.id === id);
        const title = ((src ? src.title : doc.docTitle) || 'Untitled') + ' 사본';
        const copy = JSON.parse(JSON.stringify(doc));
        copy.docTitle = title;
        return this.createProject(copy, title);
    }

    /** 기존 단일 문서를 첫 프로젝트로 이전 (인덱스가 비어있을 때만) */
    migrateLegacy() {
        if (this.listProjects().length > 0) return null;
        const legacy = this._read(this.LEGACY_KEY);
        const doc = legacy ? MM.Security.sanitizeDocument(legacy) : null;
        if (doc) return this.createProject(doc, doc.docTitle || 'Untitled Project');
        return null;
    }
};

MM.LocalStorageProvider = class {
    constructor(key) {
        this.key = key;
    }

    /** @returns {object|null} 검증·정규화된 문서 */
    load() {
        let raw;
        try {
            raw = localStorage.getItem(this.key);
        } catch (e) {
            return null; // 프라이빗 모드 등으로 localStorage 접근 불가
        }
        if (!raw) return null;
        try {
            const parsed = JSON.parse(raw);
            return MM.Security.sanitizeDocument(parsed); // 신뢰 불가 입력 → 검증
        } catch (e) {
            return null;
        }
    }

    /** @returns {{ok:boolean, error?:Error, reason?:string}} */
    save(doc) {
        try {
            localStorage.setItem(this.key, JSON.stringify(doc));
            return { ok: true };
        } catch (e) {
            const quota = e && (e.name === 'QuotaExceededError' || e.code === 22);
            return { ok: false, error: e, reason: quota ? 'quota' : 'unknown' };
        }
    }
};
