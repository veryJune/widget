/* ============================================================
 * MinimalMind — Cloud sync (단일 비밀번호)
 *   서버리스 /api/store 와 통신. 비밀번호는 헤더 x-mm-key 로 전송,
 *   서버에서 APP_PASSWORD 와 비교(서버측 검증). 데이터는 로컬이
 *   source of truth 이며, 변경 시 디바운스 업로드 / 접속 시 병합.
 *
 *   응답 규약:
 *     GET  /api/store  → 200 {data}| 200 {empty:true} | 401 | (4xx=미설정)
 *     PUT  /api/store  → 200 {ok}   | 401
 * ============================================================ */
window.MM = window.MM || {};

MM.CloudSync = class {
    constructor(store) {
        this.store = store;
        this.endpoint = '/api/store';
        this.LS = 'minimalMind_cloud_v1';
        this.state = this._load();   // { enabled, password, lastSync }
        this.onStatus = null;        // (status:'idle'|'syncing'|'synced'|'error'|'off') => void
        this._t = null;
    }

    _load() {
        try { return JSON.parse(localStorage.getItem(this.LS)) || {}; }
        catch (e) { return {}; }
    }
    _save() { try { localStorage.setItem(this.LS, JSON.stringify(this.state)); } catch (e) { /* ignore */ } }

    isEnabled() { return !!this.state.enabled && !!this.state.password; }
    lastSync() { return this.state.lastSync || 0; }

    _fetch(method, body) {
        return fetch(this.endpoint, {
            method,
            headers: {
                'x-mm-key': this.state.password || '',
                ...(body ? { 'content-type': 'application/json' } : {}),
            },
            body: body ? JSON.stringify(body) : undefined,
            cache: 'no-store',
        });
    }

    /** 비밀번호로 접속 시도. 성공 시 활성화 + (있으면) 원격 데이터 반환 */
    async connect(password) {
        let res;
        try {
            res = await fetch(this.endpoint, { method: 'GET', headers: { 'x-mm-key': password }, cache: 'no-store' });
        } catch (e) {
            return { ok: false, reason: 'network' };
        }
        if (res.status === 401) return { ok: false, reason: 'auth' };
        // 서버리스 함수가 없으면(미설정) JSON 이 아니거나 4xx/5xx HTML 반환
        let json = null;
        try { json = await res.json(); } catch (e) { return { ok: false, reason: 'server' }; }
        if (!res.ok || (json && json.error && !('empty' in json) && !('data' in json))) {
            return { ok: false, reason: 'server', message: json && json.error };
        }
        this.state.enabled = true;
        this.state.password = password;
        this._save();
        return { ok: true, data: json && json.data ? json.data : null };
    }

    disconnect() {
        this.state.enabled = false;
        this.state.password = null;
        this._save();
        if (this.onStatus) this.onStatus('off');
    }

    async pull() {
        if (!this.isEnabled()) return null;
        const res = await this._fetch('GET');
        if (res.status === 401) { this.disconnect(); throw new Error('auth'); }
        const json = await res.json();
        return json && json.data ? json.data : null;
    }

    async push(bundle) {
        if (!this.isEnabled()) return;
        const res = await this._fetch('PUT', bundle);
        if (res.status === 401) { this.disconnect(); throw new Error('auth'); }
        if (!res.ok) throw new Error('push ' + res.status);
        this.state.lastSync = Date.now();
        this._save();
    }

    /** 로컬 변경 후 호출 — 디바운스 업로드 */
    scheduleSync(getBundle) {
        if (!this.isEnabled()) return;
        if (this.onStatus) this.onStatus('syncing');
        clearTimeout(this._t);
        this._t = setTimeout(async () => {
            try { await this.push(getBundle()); if (this.onStatus) this.onStatus('synced'); }
            catch (e) { if (this.onStatus) this.onStatus('error'); }
        }, 2500);
    }
};
