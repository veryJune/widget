/* ============================================================
 * MinimalMind — Main application
 * 의존: data.js, security.js, storage.js (이 순서로 로드)
 * ============================================================ */
(function () {
    const { CONFIG, RANDOM_TITLES, INSPIRATION, Security } = MM;
    const Sec = Security;

    class MinimalMind {
        constructor() {
            this.nodes = {};
            this.rootId = null;
            this.history = [];
            this.historyIdx = -1;

            this.view = { x: 0, y: 0, scale: 1 };
            this.isPanning = false;
            this.lastMouse = { x: 0, y: 0 };

            this.selectedId = null;
            this.editingId = null;
            this.contextMenuId = null;

            this.dragNodeId = null;
            this.isResizing = false;
            this.resizeNodeId = null;
            this.resizeStartX = 0;
            this.resizeStartWidth = 0;

            this.GAP_X = CONFIG.GAP_X;
            this.GAP_Y = CONFIG.GAP_Y;

            this.docTitle = "Untitled Project";
            this.isColorMode = false;
            this.randomTitles = RANDOM_TITLES;

            // DOM refs
            this.viewport = document.getElementById('viewport');
            this.world = document.getElementById('world');
            this.svg = document.getElementById('lines-layer');
            this.nodesLayer = document.getElementById('nodes-layer');
            this.contextMenu = document.getElementById('context-menu');
            this.helpModal = document.getElementById('help-modal');
            this.saveModal = document.getElementById('save-modal');
            this.saveIndicator = document.getElementById('save-indicator');
            this.zoomIndicator = document.getElementById('zoom-indicator');
            this.titleInput = document.getElementById('doc-title');
            this.colorBtn = document.getElementById('btn-color');
            this.onboardingHint = document.getElementById('onboarding-hint');
            this.toastContainer = document.getElementById('toast-container');
            this.themePanel = document.getElementById('theme-panel');
            this.minimap = document.getElementById('minimap');
            this.minimapWrap = document.getElementById('minimap-wrap');
            this.searchBar = document.getElementById('search-bar');
            this.searchInput = document.getElementById('search-input');
            this.searchCount = document.getElementById('search-count');

            // 검색 상태
            this.searchMatches = [];
            this.searchIdx = 0;
            this.searchSet = new Set();

            // 다중 프로젝트 스토어
            this.store = new MM.ProjectStore();
            this.activeProjectId = null;
            this.projectsModal = document.getElementById('projects-modal');

            // 클라우드 동기화 (Phase 2)
            this.cloudModal = document.getElementById('cloud-modal');
            this.cloud = new MM.CloudSync(this.store);
            this.cloud.onStatus = (s) => this.updateCloudStatus(s);

            // 사용자 환경설정(테마/미니맵/힌트)은 문서와 분리해서 저장
            this.PREFS_KEY = 'minimalMind_prefs_v1';
            this.prefs = this.loadPrefs();

            this.inspirationData = INSPIRATION;
            this.currentInspCategory = Object.keys(INSPIRATION)[0];
            this.tips = [].concat(...Object.values(INSPIRATION));

            this.init();
        }

        /* ---------- lifecycle ---------- */
        init() {
            this.loadFromStorage();

            if (!this.docTitle || this.docTitle === "Untitled Project") {
                this.docTitle = this.randomTitles[Math.floor(Math.random() * this.randomTitles.length)];
            }
            this.titleInput.value = this.docTitle;

            if (!this.rootId) this.reset();
            else {
                this.history = [];
                this.historyIdx = -1;
                this.saveState();
            }

            this.applyPrefs();
            this.renderInspirationTabs();
            this.renderInspirationList();
            this.refreshTip(true);
            this.setupEvents();
            this.updateColorModeUI();

            requestAnimationFrame(() => {
                this.render();
                this.updateLayout();
                this.centerView();
                this.renderMinimap();
            });

            // 클라우드가 켜져 있으면 로드 직후 원격과 병합
            if (this.cloud.isEnabled()) {
                this.updateCloudStatus('connected');
                this.cloudPullAndMerge();
            }
        }

        /* ---------- toast ---------- */
        showToast(message, type = 'info') {
            if (!this.toastContainer) return;
            const t = document.createElement('div');
            t.className = `toast ${type}`;
            t.textContent = message;
            this.toastContainer.appendChild(t);
            requestAnimationFrame(() => t.classList.add('show'));
            setTimeout(() => {
                t.classList.remove('show');
                setTimeout(() => t.remove(), 300);
            }, 2600);
        }

        /* ---------- tips / inspiration ---------- */
        refreshTip(manual = false) {
            const el = document.getElementById('daily-tip');
            if (!el) return;
            const pick = () => this.tips[Math.floor(Math.random() * this.tips.length)];
            if (!manual) {
                el.classList.add('fade-out');
                setTimeout(() => {
                    el.innerText = pick();
                    el.classList.remove('fade-out');
                }, 300);
            } else {
                el.innerText = pick();
            }
        }

        renderInspirationTabs() {
            const container = document.getElementById('insp-tabs');
            container.innerHTML = Object.keys(this.inspirationData).map(cat =>
                `<button class="insp-cat-btn ${cat === this.currentInspCategory ? 'active' : ''}"
                    onclick="app.setInspCategory('${Sec.escapeHTML(cat)}')">${Sec.escapeHTML(cat)}</button>`
            ).join('');
        }

        setInspCategory(cat) {
            this.currentInspCategory = cat;
            this.renderInspirationTabs();
            this.renderInspirationList();
        }

        renderInspirationList() {
            const list = document.getElementById('tip-list');
            const items = this.inspirationData[this.currentInspCategory] || [];
            // 정적 데이터지만 일관성을 위해 escape
            list.innerHTML = items.map(t =>
                `<li><span class="tip-icon">💡</span> ${Sec.escapeHTML(t)}</li>`
            ).join('');
        }

        /* ---------- title (root 노드와 양방향 동기화) ---------- */
        updateTitle(newTitle) {
            this.docTitle = (newTitle && newTitle.trim()) ? newTitle : "Untitled Project";
            if (this.rootId && this.nodes[this.rootId]) {
                this.nodes[this.rootId].text = this.docTitle;
            }
            this.render();
            this.updateLayout();
            this.saveState();
        }

        /* ---------- modes / modals ---------- */
        toggleColorMode() {
            this.isColorMode = !this.isColorMode;
            this.updateColorModeUI();
            this.render();
            this.saveState();
        }

        updateColorModeUI() {
            this.colorBtn.classList.toggle('active', this.isColorMode);
        }

        /* ---------- preferences (테마/미니맵/힌트) ---------- */
        loadPrefs() {
            const def = { dark: false, accent: '#007AFF', font: 'sans', fontScale: 1, curve: 'curved', palette: 'pastel', minimap: true, hint: 'mini' };
            const FONTS = ['sans', 'serif', 'rounded', 'hand'];
            const SCALES = [0.9, 1, 1.15, 1.35];
            const CURVES = ['curved', 'elbow', 'straight'];
            const PALETTES = ['pastel', 'vivid', 'mono'];
            try {
                const raw = localStorage.getItem(this.PREFS_KEY);
                if (!raw) return def;
                const p = JSON.parse(raw);
                // 구버전 hintDismissed(boolean) → hint('shown'|'mini') 이전
                let hint = (p.hint === 'shown' || p.hint === 'mini') ? p.hint : (p.hintDismissed ? 'mini' : 'shown');
                return {
                    dark: !!p.dark,
                    accent: typeof p.accent === 'string' ? p.accent : def.accent,
                    font: FONTS.includes(p.font) ? p.font : 'sans',
                    fontScale: SCALES.includes(p.fontScale) ? p.fontScale : 1,
                    curve: CURVES.includes(p.curve) ? p.curve : 'curved',
                    palette: PALETTES.includes(p.palette) ? p.palette : 'pastel',
                    minimap: p.minimap !== false,
                    hint,
                };
            } catch (e) { return def; }
        }

        savePrefs() {
            try { localStorage.setItem(this.PREFS_KEY, JSON.stringify(this.prefs)); } catch (e) { /* ignore */ }
        }

        applyFontClass() {
            document.body.classList.remove('font-serif', 'font-rounded', 'font-hand');
            if (this.prefs.font === 'serif') document.body.classList.add('font-serif');
            else if (this.prefs.font === 'rounded') document.body.classList.add('font-rounded');
            else if (this.prefs.font === 'hand') document.body.classList.add('font-hand');
        }

        applyPrefs() {
            document.body.classList.toggle('dark-mode', this.prefs.dark);
            // accent 는 body 인라인으로 지정해야 dark-mode 클래스 값을 덮어쓸 수 있음
            document.body.style.setProperty('--accent-color', this.prefs.accent);
            document.body.style.setProperty('--node-font-scale', this.prefs.fontScale);
            this.applyFontClass();
            if (this.minimapWrap) this.minimapWrap.classList.toggle('hidden', !this.prefs.minimap);
            this.updateOnboarding();
            this.syncThemePanelUI();
        }

        setFontScale(scale) {
            const SCALES = [0.9, 1, 1.15, 1.35];
            this.prefs.fontScale = SCALES.includes(scale) ? scale : 1;
            document.body.style.setProperty('--node-font-scale', this.prefs.fontScale);
            this.savePrefs();
            this.syncThemePanelUI();
            this.updateLayout(); // 글자 크기 변경 → 노드 재측정
        }

        toggleDarkMode() {
            this.prefs.dark = !this.prefs.dark;
            document.body.classList.toggle('dark-mode', this.prefs.dark);
            this.savePrefs();
            this.renderMinimap();
        }

        toggleThemePanel() {
            this.themePanel.classList.toggle('active');
            this.syncThemePanelUI();
        }
        closeThemePanel() { this.themePanel.classList.remove('active'); }

        setAccent(color) {
            this.prefs.accent = color;
            document.body.style.setProperty('--accent-color', color);
            this.savePrefs();
            this.syncThemePanelUI();
            this.render();
            this.renderMinimap();
        }

        setFont(font) {
            const FONTS = ['sans', 'serif', 'rounded', 'hand'];
            this.prefs.font = FONTS.includes(font) ? font : 'sans';
            this.applyFontClass();
            this.savePrefs();
            this.syncThemePanelUI();
            this.updateLayout(); // 글꼴 변경 → 노드 크기 재계산
        }

        setCurve(style) {
            const CURVES = ['curved', 'elbow', 'straight'];
            this.prefs.curve = CURVES.includes(style) ? style : 'curved';
            this.savePrefs();
            this.syncThemePanelUI();
            this.render();
        }

        setPalette(p) {
            const PALETTES = ['pastel', 'vivid', 'mono'];
            this.prefs.palette = PALETTES.includes(p) ? p : 'pastel';
            this.savePrefs();
            this.syncThemePanelUI();
            if (!this.isColorMode) { this.isColorMode = true; this.updateColorModeUI(); } // 프리셋 고르면 컬러모드 자동 on
            this.render();
        }

        toggleMinimapPref() {
            this.prefs.minimap = !this.prefs.minimap;
            this.minimapWrap.classList.toggle('hidden', !this.prefs.minimap);
            this.savePrefs();
            this.syncThemePanelUI();
            if (this.prefs.minimap) this.renderMinimap();
        }

        syncThemePanelUI() {
            if (!this.themePanel) return;
            this.themePanel.querySelectorAll('.swatch').forEach(s => {
                s.classList.toggle('active', s.dataset.color && s.dataset.color.toLowerCase() === this.prefs.accent.toLowerCase());
            });
            this.themePanel.querySelectorAll('[data-font]').forEach(b => {
                b.classList.toggle('active', b.dataset.font === this.prefs.font);
            });
            this.themePanel.querySelectorAll('[data-curve]').forEach(b => {
                b.classList.toggle('active', b.dataset.curve === this.prefs.curve);
            });
            this.themePanel.querySelectorAll('[data-palette]').forEach(b => {
                b.classList.toggle('active', b.dataset.palette === this.prefs.palette);
            });
            this.themePanel.querySelectorAll('[data-scale]').forEach(b => {
                b.classList.toggle('active', parseFloat(b.dataset.scale) === this.prefs.fontScale);
            });
            const mm = this.themePanel.querySelector('#pref-minimap');
            if (mm) mm.checked = this.prefs.minimap;
            const hintChk = this.themePanel.querySelector('#pref-hint');
            if (hintChk) hintChk.checked = (this.prefs.hint === 'shown');
        }

        /* ---------- search (Ctrl+F) ---------- */
        openSearch() {
            this.searchBar.classList.add('active');
            this.searchInput.focus();
            this.searchInput.select();
        }

        closeSearch() {
            this.searchBar.classList.remove('active');
            this.searchMatches = [];
            this.searchIdx = 0;
            this.searchSet.clear();
            this.render();
        }

        doSearch(q) {
            const query = (q || '').trim().toLowerCase();
            this.searchSet.clear();
            this.searchMatches = [];
            if (query) {
                Object.values(this.nodes).forEach(n => {
                    const text = n.text.replace(/^\[x?\] /, '').toLowerCase();
                    if (text.includes(query)) { this.searchMatches.push(n.id); this.searchSet.add(n.id); }
                });
            }
            this.searchIdx = 0;
            this.updateSearchCount();
            this.render();
            if (this.searchMatches.length) this.gotoMatch(0);
        }

        updateSearchCount() {
            const total = this.searchMatches.length;
            if (this.searchCount) this.searchCount.textContent = total ? `${this.searchIdx + 1}/${total}` : '0';
        }

        gotoMatch(idx) {
            if (!this.searchMatches.length) return;
            this.searchIdx = (idx + this.searchMatches.length) % this.searchMatches.length;
            const id = this.searchMatches[this.searchIdx];
            // 접힌 조상 펼치기
            let p = this.nodes[this.nodes[id].parentId];
            let changed = false;
            while (p) { if (p.folded) { p.folded = false; changed = true; } p = this.nodes[p.parentId]; }
            if (changed) this.updateLayout();
            this.selectedId = id;
            this.render();
            this.centerOnNode(id);
            this.updateSearchCount();
        }

        nextMatch() { this.gotoMatch(this.searchIdx + 1); }
        prevMatch() { this.gotoMatch(this.searchIdx - 1); }

        toggleHelp() { this.helpModal.classList.toggle('active'); }

        openSaveModal() {
            this.saveModal.classList.add('active');
            const input = document.getElementById('save-filename');
            input.value = this.docTitle + ".json";
            input.focus();
        }

        closeSaveModal() { this.saveModal.classList.remove('active'); }

        confirmSave() {
            const inputName = document.getElementById('save-filename').value;
            const filename = (inputName && inputName.trim() !== "") ? inputName : 'MinimalMind.json';
            this.saveFile(filename);
            this.closeSaveModal();
        }

        switchHelpTab(tabName) {
            const order = ['shortcuts', 'guide', 'inspiration'];
            const idx = Math.max(0, order.indexOf(tabName));
            document.querySelectorAll('.help-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.help-page').forEach(p => p.classList.remove('active'));
            const tabs = document.querySelectorAll('.help-tab');
            if (tabs[idx]) tabs[idx].classList.add('active');
            const page = document.getElementById('help-' + order[idx]);
            if (page) page.classList.add('active');
        }

        /* ---------- context menu ---------- */
        showContextMenu(x, y, nodeId) {
            this.contextMenuId = nodeId;
            this.contextMenu.style.display = 'flex';
            const menuWidth = 200, menuHeight = 150;
            let finalX = (x + menuWidth > window.innerWidth) ? x - menuWidth : x;
            let finalY = (y + menuHeight > window.innerHeight) ? y - menuHeight : y;
            this.contextMenu.style.left = finalX + 'px';
            this.contextMenu.style.top = finalY + 'px';
        }

        hideContextMenu() {
            this.contextMenu.style.display = 'none';
            this.contextMenuId = null;
        }

        deleteNodeFromContext() {
            if (this.contextMenuId) {
                this.deleteNode(this.contextMenuId);
                this.hideContextMenu();
            }
        }

        setNodeColor(color) {
            const id = this.contextMenuId;
            if (!id || id === this.rootId) { this.hideContextMenu(); return; }
            if (color) this.nodes[id].color = color;
            else delete this.nodes[id].color;
            this.hideContextMenu();
            this.render();
            this.saveState();
        }

        toggleCheckbox(nodeId) {
            const node = this.nodes[nodeId];
            if (!node) return;
            if (node.text.startsWith('[] ')) node.text = node.text.replace('[] ', '[x] ');
            else if (node.text.startsWith('[x] ')) node.text = node.text.replace('[x] ', '[] ');
            else node.text = '[] ' + node.text;
            this.hideContextMenu();
            this.render();
            this.saveState();
        }

        /* ---------- history ---------- */
        saveState() {
            const state = JSON.stringify({ nodes: this.nodes, rootId: this.rootId, docTitle: this.docTitle, isColorMode: this.isColorMode });
            if (this.historyIdx >= 0 && this.history[this.historyIdx] === state) return;
            if (this.historyIdx < this.history.length - 1) {
                this.history = this.history.slice(0, this.historyIdx + 1);
            }
            this.history.push(state);
            this.historyIdx++;
            if (this.history.length > CONFIG.HISTORY_LIMIT) {
                this.history.shift();
                this.historyIdx--;
            }
            this.updateUndoRedoBtns();
            this.saveToStorage(state); // 이미 만든 문자열 재사용 (재직렬화 생략)
        }

        undo() {
            if (this.historyIdx <= 0) return;
            this.historyIdx--;
            this.restoreState();
        }

        redo() {
            if (this.historyIdx >= this.history.length - 1) return;
            this.historyIdx++;
            this.restoreState();
        }

        restoreState() {
            let state;
            try { state = JSON.parse(this.history[this.historyIdx]); }
            catch (e) { this.showToast('실행 취소 기록이 손상되어 복원할 수 없습니다.', 'error'); return; }
            this.nodes = state.nodes;
            this.rootId = state.rootId;
            this.docTitle = state.docTitle || "Untitled Project";
            this.isColorMode = state.isColorMode || false;

            this.titleInput.value = this.docTitle;
            this.updateColorModeUI();

            this.selectedId = null;
            this.editingId = null;
            this.nodesLayer.innerHTML = '';
            this.render();
            this.updateLayout();
            this.updateUndoRedoBtns();
            this.saveToStorage();
        }

        updateUndoRedoBtns() {
            document.getElementById('btn-undo').disabled = this.historyIdx <= 0;
            document.getElementById('btn-redo').disabled = this.historyIdx >= this.history.length - 1;
        }

        /* ---------- node CRUD ---------- */
        createNode(parentId = null, text = "") {
            const id = 'n' + Date.now() + Math.random().toString(36).slice(2, 5);
            this.nodes[id] = {
                id, text, parentId, children: [],
                x: 0, y: 0, width: 0, height: 0,
                customWidth: null, folded: false, colorIdx: 0,
                direction: 'right'
            };

            if (parentId) {
                const parent = this.nodes[parentId];
                if (this.selectedId && this.nodes[this.selectedId].parentId === parentId) {
                    const sibling = this.nodes[this.selectedId];
                    this.nodes[id].direction = sibling.direction;
                    const siblingIdx = parent.children.indexOf(this.selectedId);
                    if (siblingIdx !== -1) parent.children.splice(siblingIdx + 1, 0, id);
                    else parent.children.push(id);
                } else {
                    if (parent.direction) this.nodes[id].direction = parent.direction;
                    if (parentId === this.rootId) this.nodes[id].direction = 'right';
                    parent.children.push(id);
                }

                if (parentId === this.rootId) {
                    this.nodes[id].colorIdx = this.nodes[this.rootId].children.length;
                } else {
                    this.nodes[id].colorIdx = this.nodes[parentId].colorIdx;
                }
            } else {
                this.rootId = id;
                this.nodes[id].text = this.docTitle;
                this.nodes[id].direction = 'root';
            }

            this.render();
            this.updateLayout();
            return id;
        }

        deleteNode(id) {
            if (id === this.rootId || !id) return;
            this.stopEditing();

            const parentId = this.nodes[id] ? this.nodes[id].parentId : null;
            const parent = this.nodes[parentId];
            if (parent) parent.children = parent.children.filter(cid => cid !== id);

            const deleteRecursive = (nid) => {
                const n = this.nodes[nid];
                if (n && n.children) n.children.forEach(deleteRecursive);
                delete this.nodes[nid];
            };
            deleteRecursive(id);

            this.selectNode(null);
            this.updateLayout();
            this.saveState();
        }

        toggleFold(id) {
            this.stopEditing();
            const node = this.nodes[id];
            if (node.children.length > 0) {
                node.folded = !node.folded;
                this.updateLayout();
                this.saveState();
            }
        }

        /* ---------- layout ---------- */
        updateLayout() {
            if (!this.rootId) return;
            Object.values(this.nodes).forEach(node => {
                const el = document.getElementById(node.id);
                if (el) { node.width = el.offsetWidth; node.height = el.offsetHeight; }
            });

            const root = this.nodes[this.rootId];
            const leftChildren = [];
            const rightChildren = [];
            root.children.forEach((cid) => {
                const child = this.nodes[cid];
                if (child.direction === 'left') leftChildren.push(cid);
                else rightChildren.push(cid);
            });

            const calcSize = (id) => {
                const node = this.nodes[id];
                if (node.folded || node.children.length === 0) {
                    node.subtreeHeight = node.height;
                    return;
                }
                let h = 0;
                node.children.forEach(cid => { calcSize(cid); h += this.nodes[cid].subtreeHeight; });
                h += (node.children.length - 1) * this.GAP_Y;
                node.subtreeHeight = Math.max(node.height, h);
            };

            leftChildren.forEach(calcSize);
            rightChildren.forEach(calcSize);
            root.subtreeHeight = root.height;

            const setPos = (id, x, y, dir, depth) => {
                const node = this.nodes[id];
                node.x = x; node.y = y; node.direction = dir; node.depth = depth;
                if (node.folded || node.children.length === 0) return;

                let totalChildH = 0;
                node.children.forEach(cid => totalChildH += this.nodes[cid].subtreeHeight);
                totalChildH += (node.children.length - 1) * this.GAP_Y;

                let currentY = y - totalChildH / 2;
                node.children.forEach(cid => {
                    const child = this.nodes[cid];
                    const childY = currentY + child.subtreeHeight / 2;
                    let childX;
                    if (dir === 'right') childX = x + node.width + 40 + (this.GAP_X - 40);
                    else childX = x - (this.GAP_X - 40) - child.width - 40;
                    setPos(cid, childX, childY, dir, depth + 1);
                    currentY += child.subtreeHeight + this.GAP_Y;
                });
            };

            root.x = 0; root.y = 0; root.direction = 'root'; root.depth = 0;

            let totalRH = 0;
            rightChildren.forEach(cid => totalRH += this.nodes[cid].subtreeHeight);
            totalRH += Math.max(0, (rightChildren.length - 1) * this.GAP_Y);
            let curRightY = -(totalRH / 2);
            rightChildren.forEach(cid => {
                const child = this.nodes[cid];
                const cy = curRightY + child.subtreeHeight / 2;
                setPos(cid, root.width + this.GAP_X, cy, 'right', 1);
                curRightY += child.subtreeHeight + this.GAP_Y;
            });

            let totalLH = 0;
            leftChildren.forEach(cid => totalLH += this.nodes[cid].subtreeHeight);
            totalLH += Math.max(0, (leftChildren.length - 1) * this.GAP_Y);
            let curLeftY = -(totalLH / 2);
            leftChildren.forEach(cid => {
                const child = this.nodes[cid];
                const cy = curLeftY + child.subtreeHeight / 2;
                setPos(cid, -(this.GAP_X + child.width), cy, 'left', 1);
                curLeftY += child.subtreeHeight + this.GAP_Y;
            });

            this.render();
        }

        /* ---------- view-only update (이동/줌: 노드·링크 재구성 없이 transform 만) ---------- */
        updateViewTransform() {
            this.world.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.scale})`;
            this.zoomIndicator.innerText = `${Math.round(this.view.scale * 100)}%`;
            this.renderMinimap();
        }

        /* ---------- render ---------- */
        render() {
            this.world.style.transform = `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.scale})`;
            this.zoomIndicator.innerText = `${Math.round(this.view.scale * 100)}%`;

            const existingEls = {};
            Array.from(this.nodesLayer.children).forEach(el => existingEls[el.id] = el);
            this.svgPathBuffer = "";

            const drawRecursive = (id) => {
                const node = this.nodes[id];
                if (!node) return;
                let el = existingEls[id];

                // ---- color computation (lightness 를 상위 스코프에 선언: 링크색 참조 버그 수정) ----
                let nodeBg = 'var(--node-bg)';
                let nodeBorder = 'transparent';
                let strokeColor = 'var(--line-color)';
                let textColor = 'var(--text-color)';
                let lightness = 100;

                if (this.isColorMode) {
                    if (id === this.rootId) {
                        nodeBg = 'var(--node-bg)';
                        strokeColor = 'var(--line-color)';
                    } else {
                        const c = this.paletteColor(node.colorIdx, node.depth || 1);
                        nodeBg = c.bg; nodeBorder = c.border; strokeColor = c.stroke;
                        textColor = c.text; lightness = c.light;
                    }
                }

                // 노드별 개별 색이 지정되면 컬러모드보다 우선
                const hasCustom = node.color && id !== this.rootId;
                if (hasCustom) {
                    nodeBg = node.color;
                    nodeBorder = this.darken(node.color, 0.28);
                    strokeColor = this.darken(node.color, 0.12);
                    textColor = this.contrastText(node.color);
                    lightness = this.luminance(node.color) * 100;
                }

                // 편집 중인 노드는 위치만 갱신 (텍스트 보존)
                if (this.editingId === id && el) {
                    el.style.left = `${node.x}px`;
                    el.style.top = `${node.y}px`;
                    delete existingEls[id];
                    if (node.parentId) this.drawLink(node, strokeColor);
                    if (!node.folded) node.children.forEach(drawRecursive);
                    return;
                }

                if (!el) {
                    el = this.createNodeElement(id);
                    el.classList.add('node-enter');
                    el.addEventListener('animationend', () => el.classList.remove('node-enter'), { once: true });
                    this.nodesLayer.appendChild(el);
                } else {
                    delete existingEls[id];
                }

                el.className = `node ${(this.isColorMode || hasCustom) ? 'colored-mode' : ''} ${this.selectedId === id ? 'selected' : ''} ${this.searchSet.has(id) ? 'search-match' : ''}`;
                el.style.backgroundColor = nodeBg;
                el.style.color = textColor;

                if (this.selectedId === id) el.style.borderColor = 'var(--accent-color)';
                else if (hasCustom) el.style.borderColor = nodeBorder;
                else if (this.isColorMode && id !== this.rootId) el.style.borderColor = nodeBorder;
                else el.style.borderColor = (id === this.rootId) ? 'var(--line-color)' : 'transparent';

                el.dataset.dir = node.direction;
                el.dataset.isRoot = (id === this.rootId);
                el.style.width = node.customWidth ? node.customWidth + 'px' : '';

                // ---- 안전한 텍스트/이미지 구성 (innerHTML 미사용 → XSS 불가) ----
                this.renderNodeContent(el, node, id, lightness);

                el.style.left = `${node.x}px`;
                el.style.top = `${node.y}px`;

                const btn = el.querySelector('.fold-btn');
                if (node.children.length > 0) {
                    btn.style.display = 'flex';
                    btn.innerText = node.folded ? '+' : '-';
                    btn.className = `fold-btn ${node.folded ? 'folded' : ''}`;
                } else {
                    btn.style.display = 'none';
                }

                if (node.parentId) this.drawLink(node, strokeColor);
                if (!node.folded) node.children.forEach(drawRecursive);
            };

            if (this.rootId) drawRecursive(this.rootId);
            Object.values(existingEls).forEach(el => el.remove());
            this.svg.innerHTML = this.svgPathBuffer;

            this.updateOnboarding();
            this.renderMinimap();
        }

        createNodeElement(id) {
            const el = document.createElement('div');
            el.id = id;
            el.tabIndex = 0;
            el.onmousedown = (e) => this.handleNodeDown(e, id);
            el.ondblclick = (e) => { e.stopPropagation(); this.startEditing(id); };
            el.onkeydown = (e) => this.handleKey(e);
            el.onclick = (e) => { if (e.altKey) this.handleLinkClick(e, this.nodes[id].text); };
            el.oncontextmenu = (e) => {
                e.preventDefault(); e.stopPropagation();
                this.selectNode(id);
                this.showContextMenu(e.clientX, e.clientY, id);
            };
            el.ondragover = (e) => { e.preventDefault(); el.classList.add('drag-over'); };
            el.ondragleave = (e) => { e.preventDefault(); el.classList.remove('drag-over'); };
            el.ondrop = (e) => this.handleImageDrop(e, id);

            const text = document.createElement('div'); text.className = 'node-text'; el.appendChild(text);
            const btn = document.createElement('div'); btn.className = 'fold-btn';
            btn.onclick = (e) => { e.stopPropagation(); this.toggleFold(id); }; el.appendChild(btn);
            const handle = document.createElement('div'); handle.className = 'resize-handle';
            handle.onmousedown = (e) => this.startResizing(e, id);
            handle.ondblclick = (e) => { e.stopPropagation(); this.nodes[id].customWidth = null; this.updateLayout(); this.saveState(); };
            el.appendChild(handle);
            return el;
        }

        /** 노드 본문(이미지+체크박스+텍스트)을 안전한 DOM 으로 구성 */
        renderNodeContent(el, node, id, lightness) {
            const textEl = el.querySelector('.node-text');
            textEl.textContent = '';

            if (node.image && Sec.isSafeImageSrc(node.image)) {
                const img = document.createElement('img');
                img.src = node.image;
                img.className = 'node-image';
                img.draggable = false;
                textEl.appendChild(img);
            }

            const { state, rest } = Sec.parseCheckbox(node.text);
            if (state !== 'none') {
                const cb = document.createElement('span');
                cb.className = 'checkbox' + (state === 'checked' ? ' checked' : '');
                cb.addEventListener('mousedown', (e) => { e.stopPropagation(); this.toggleCheckbox(id); });
                textEl.appendChild(cb);
            }

            const linkColor = (this.isColorMode && lightness < 60) ? '#8ecfff' : 'var(--accent-color)';
            textEl.appendChild(Sec.buildRichTextNodes(rest, linkColor));
        }

        /* ---------- link geometry (곡선 스타일 공용) ---------- */
        linkEndpoints(p, n) {
            const isLeft = n.x < p.x;
            const sx = isLeft ? p.x : p.x + p.width;
            const ex = isLeft ? n.x + n.width : n.x;
            return { sx, sy: p.y, ex, ey: n.y, isLeft };
        }

        linkPathD(p, n) {
            const { sx, sy, ex, ey, isLeft } = this.linkEndpoints(p, n);
            const style = this.prefs.curve;
            if (style === 'straight') return `M ${sx} ${sy} L ${ex} ${ey}`;
            if (style === 'elbow') {
                const midX = (sx + ex) / 2;
                return `M ${sx} ${sy} L ${midX} ${sy} L ${midX} ${ey} L ${ex} ${ey}`;
            }
            const dist = Math.abs(ex - sx);
            const cp1x = isLeft ? sx - dist * 0.4 : sx + dist * 0.4;
            const cp2x = isLeft ? ex + dist * 0.4 : ex - dist * 0.4;
            return `M ${sx} ${sy} C ${cp1x} ${sy}, ${cp2x} ${ey}, ${ex} ${ey}`;
        }

        strokeLinkOnCanvas(ctx, p, n, mapX, mapY) {
            const { sx, sy, ex, ey, isLeft } = this.linkEndpoints(p, n);
            const style = this.prefs.curve;
            ctx.beginPath();
            ctx.moveTo(mapX(sx), mapY(sy));
            if (style === 'straight') {
                ctx.lineTo(mapX(ex), mapY(ey));
            } else if (style === 'elbow') {
                const midX = (sx + ex) / 2;
                ctx.lineTo(mapX(midX), mapY(sy));
                ctx.lineTo(mapX(midX), mapY(ey));
                ctx.lineTo(mapX(ex), mapY(ey));
            } else {
                const dist = Math.abs(ex - sx);
                const cp1x = isLeft ? sx - dist * 0.4 : sx + dist * 0.4;
                const cp2x = isLeft ? ex + dist * 0.4 : ex - dist * 0.4;
                ctx.bezierCurveTo(mapX(cp1x), mapY(sy), mapX(cp2x), mapY(ey), mapX(ex), mapY(ey));
            }
            ctx.stroke();
        }

        drawLink(node, color) {
            const p = this.nodes[node.parentId];
            if (!p) return;
            this.svgPathBuffer += `<path d="${this.linkPathD(p, node)}" class="link" style="stroke:${color};"></path>`;
        }

        /* ---------- color utils (노드별 개별 색) ---------- */
        hexToRgb(hex) {
            const m = String(hex).replace('#', '');
            const v = m.length === 3 ? m.split('').map(c => c + c).join('') : m.slice(0, 6);
            const n = parseInt(v, 16);
            return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
        }
        luminance(hex) {
            const { r, g, b } = this.hexToRgb(hex);
            return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        }
        contrastText(hex) { return this.luminance(hex) < 0.62 ? '#ffffff' : '#1d1d1f'; }

        /** 컬러모드 팔레트 프리셋 (파스텔/비비드/모노) */
        paletteColor(colorIdx, depth) {
            const hue = (colorIdx * 50) % 360;
            const p = this.prefs.palette;
            let sat, light, stroke;
            if (p === 'vivid') {
                sat = 85; light = Math.max(45, 72 - depth * 6);
                stroke = `hsl(${hue}, 75%, 52%)`;
            } else if (p === 'mono') {
                sat = 8; light = Math.max(34, 90 - depth * 9);
                stroke = `hsl(${hue}, 10%, 55%)`;
            } else { // pastel (default)
                sat = 72; light = Math.max(70, 93 - depth * 4);
                stroke = `hsl(${hue}, 68%, 58%)`;
            }
            return {
                bg: `hsl(${hue}, ${sat}%, ${light}%)`,
                border: `hsl(${hue}, ${sat}%, ${Math.max(20, light - 22)}%)`,
                stroke,
                text: (light < 60) ? '#fff' : 'var(--text-color)',
                light,
            };
        }
        darken(hex, amt) {
            const { r, g, b } = this.hexToRgb(hex);
            const f = v => Math.max(0, Math.round(v * (1 - amt)));
            return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
        }

        updateOnboarding() {
            if (!this.onboardingHint) return;
            // 항상 표시하되, 'mini' 이면 접힌 흐린 탭(호버 시 펼침)
            this.onboardingHint.classList.add('visible');
            this.onboardingHint.classList.toggle('mini', this.prefs.hint === 'mini');
        }

        dismissHint() {           // × → 접힌 미니 탭으로
            this.prefs.hint = 'mini';
            this.savePrefs();
            this.updateOnboarding();
        }

        setHintShown(shown) {     // 테마 패널 토글
            this.prefs.hint = shown ? 'shown' : 'mini';
            this.savePrefs();
            this.updateOnboarding();
        }

        /* ---------- images ---------- */
        handleImageDrop(e, id) {
            e.preventDefault(); e.stopPropagation();
            const el = document.getElementById(id);
            if (el) el.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) this.readAndAttachImage(file, id);
        }

        handlePaste(e) {
            if (!this.selectedId) return;
            if (e.clipboardData && e.clipboardData.files.length > 0) {
                const file = e.clipboardData.files[0];
                if (file.type.startsWith('image/')) {
                    e.preventDefault();
                    this.readAndAttachImage(file, this.selectedId);
                }
            }
        }

        // 붙여넣기/드롭 이미지를 캔버스로 리사이즈해 저장 용량을 줄인다.
        compressImage(file) {
            return new Promise((resolve, reject) => {
                const url = URL.createObjectURL(file);
                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(url);
                    const MAX = CONFIG.MAX_IMAGE_DIM;
                    let { width, height } = img;
                    if (width > MAX || height > MAX) {
                        const r = Math.min(MAX / width, MAX / height);
                        width = Math.round(width * r);
                        height = Math.round(height * r);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width; canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    // 투명도가 필요한 포맷(png/gif/webp)은 png, 사진은 jpeg 로 압축
                    const keepAlpha = /png|gif|webp/i.test(file.type);
                    resolve(keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82));
                };
                img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
                img.src = url;
            });
        }

        async readAndAttachImage(file, nodeId) {
            if (file.size > 25 * 1024 * 1024) { // 디코딩 폭주 방지용 상한
                this.showToast('이미지 파일이 너무 큽니다 (25MB 초과).', 'error');
                return;
            }
            try {
                const dataUrl = await this.compressImage(file);
                if (!Sec.isSafeImageSrc(dataUrl)) {
                    this.showToast('지원하지 않는 이미지 형식입니다.', 'error');
                    return;
                }
                if (!this.nodes[nodeId]) return;
                this.nodes[nodeId].image = dataUrl;
                this.updateLayout();
                this.render();
                this.saveState();
            } catch (e) {
                this.showToast('이미지를 불러올 수 없습니다.', 'error');
            }
        }

        handleLinkClick(e, text) {
            const match = String(text).match(Sec.URL_REGEX);
            if (match) {
                const href = Sec.safeHref(match[0]);
                if (href) window.open(href, '_blank', 'noopener,noreferrer');
            }
        }

        /* ---------- events ---------- */
        setupEvents() {
            window.addEventListener('paste', (e) => this.handlePaste(e));

            this.viewport.onmousedown = (e) => {
                if (e.button === 1) { e.preventDefault(); this.resetZoom(); return; }
                this.hideContextMenu();
                if (this.helpModal.classList.contains('active')) {
                    if (!this.helpModal.children[0].contains(e.target)) this.toggleHelp();
                }
                if (e.target === this.viewport || e.target === this.world) {
                    this.isPanning = true;
                    this.lastMouse = { x: e.clientX, y: e.clientY };
                    this.selectNode(null);
                    this.stopEditing();
                }
            };

            window.onmousemove = (e) => {
                if (this.isResizing) { this.handleResizing(e); }
                else if (this.isPanning) {
                    const dx = e.clientX - this.lastMouse.x;
                    const dy = e.clientY - this.lastMouse.y;
                    this.view.x += dx; this.view.y += dy;
                    this.lastMouse = { x: e.clientX, y: e.clientY };
                    requestAnimationFrame(() => this.updateViewTransform());
                } else if (this.dragNodeId) { this.updateDragGhost(e); }
            };

            window.onmouseup = (e) => {
                this.isPanning = false;
                this.isResizing = false;
                if (this.dragNodeId) this.endDrag(e);
            };

            this.viewport.onwheel = (e) => {
                if (e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                const delta = -e.deltaY * 0.001;
                const oldScale = this.view.scale;
                const newScale = Math.max(0.1, Math.min(oldScale + delta, 5));
                const rect = this.viewport.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const scaleRatio = newScale / oldScale;
                this.view.x = mouseX - (mouseX - this.view.x) * scaleRatio;
                this.view.y = mouseY - (mouseY - this.view.y) * scaleRatio;
                this.view.scale = newScale;
                requestAnimationFrame(() => this.updateViewTransform());
            };

            document.addEventListener('keydown', (e) => {
                // Ctrl/Cmd+S 는 편집 중에도 동작 (저장 모달 열기)
                if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
                    e.preventDefault();
                    this.stopEditing();
                    this.openSaveModal();
                    return;
                }
                // Ctrl/Cmd+F 검색 (편집 중에도)
                if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
                    e.preventDefault();
                    this.stopEditing();
                    this.openSearch();
                    return;
                }
                if (this.editingId) return;
                if (e.key === ' ' && this.selectedId) {
                    e.preventDefault();
                    this.startEditing(this.selectedId);
                }
                if (e.key === 'Escape') {
                    this.selectNode(null);
                    this.hideContextMenu();
                    this.closeThemePanel();
                    if (this.searchBar.classList.contains('active')) this.closeSearch();
                    this.helpModal.classList.remove('active');
                    this.closeSaveModal();
                    this.closeProjects();
                    this.closeCloudModal();
                }
                if (e.key === 'Home') this.centerView();
                if (e.key === 'Tab' && !this.selectedId) {
                    // 아무것도 선택 안 된 상태에서 Tab → 루트 선택(빠른 시작)
                    e.preventDefault();
                    this.selectNode(this.rootId);
                }
                if (e.ctrlKey || e.metaKey) {
                    if (e.key === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
                    else if (e.key === 'y') { e.preventDefault(); this.redo(); }
                    else if (e.key === '0') { e.preventDefault(); this.resetZoom(); }
                }
            });

            // 빈 캔버스 클릭으로 테마 패널 닫기
            this.viewport.addEventListener('mousedown', () => this.closeThemePanel());

            // 빈 캔버스 더블클릭으로 노드 빠르게 추가
            this.viewport.ondblclick = (e) => {
                if (e.target !== this.viewport && e.target !== this.world) return;
                if (!this.rootId) return;
                const newId = this.createNode(this.rootId, '새 아이디어');
                this.nodes[this.rootId].folded = false;
                this.updateLayout();
                this.selectNode(newId);
                this.startEditing(newId);
                this.saveState();
            };

            this.setupTouch();
        }

        /* ---------- touch (모바일: 한 손가락 패닝 / 두 손가락 핀치 줌) ---------- */
        setupTouch() {
            let mode = null;            // 'pan' | 'pinch'
            let panLast = null, lastDist = 0, lastMid = null;
            const dist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
            const mid = (t) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });

            this.viewport.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    const t = e.touches[0];
                    const el = document.elementFromPoint(t.clientX, t.clientY);
                    // 빈 캔버스에서만 패닝(노드 탭은 선택/편집되도록 통과)
                    if (el === this.viewport || el === this.world) { mode = 'pan'; panLast = { x: t.clientX, y: t.clientY }; }
                    else mode = null;
                } else if (e.touches.length === 2) {
                    mode = 'pinch'; lastDist = dist(e.touches); lastMid = mid(e.touches);
                    this.stopEditing();
                    e.preventDefault();
                }
            }, { passive: false });

            this.viewport.addEventListener('touchmove', (e) => {
                if (mode === 'pan' && e.touches.length === 1) {
                    const t = e.touches[0];
                    this.view.x += t.clientX - panLast.x;
                    this.view.y += t.clientY - panLast.y;
                    panLast = { x: t.clientX, y: t.clientY };
                    e.preventDefault();
                    requestAnimationFrame(() => this.updateViewTransform());
                } else if (mode === 'pinch' && e.touches.length === 2) {
                    const d = dist(e.touches), m = mid(e.touches);
                    const rect = this.viewport.getBoundingClientRect();
                    const mx = m.x - rect.left, my = m.y - rect.top;
                    const oldScale = this.view.scale;
                    const newScale = Math.max(0.1, Math.min(oldScale * (d / (lastDist || d)), 5));
                    const ratio = newScale / oldScale;
                    this.view.x = mx - (mx - this.view.x) * ratio + (m.x - lastMid.x);
                    this.view.y = my - (my - this.view.y) * ratio + (m.y - lastMid.y);
                    this.view.scale = newScale;
                    lastDist = d; lastMid = m;
                    e.preventDefault();
                    requestAnimationFrame(() => this.updateViewTransform());
                }
            }, { passive: false });

            this.viewport.addEventListener('touchend', (e) => {
                if (e.touches.length === 0) mode = null;
                else if (e.touches.length === 1) { mode = 'pan'; panLast = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }
            });
        }

        /* ---------- resize ---------- */
        startResizing(e, id) {
            e.stopPropagation();
            this.isResizing = true;
            this.resizeNodeId = id;
            this.resizeStartX = e.clientX;
            this.resizeStartWidth = this.nodes[id].width;
            this.selectNode(id);
        }

        handleResizing(e) {
            if (!this.resizeNodeId) return;
            const delta = e.clientX - this.resizeStartX;
            const node = this.nodes[this.resizeNodeId];
            node.customWidth = Math.max(60, this.resizeStartWidth + delta);
            this.render();
        }

        /* ---------- drag to reparent ---------- */
        handleNodeDown(e, id) {
            if (e.button !== 0 || e.altKey) return;
            e.stopPropagation();
            this.selectNode(id);
            this.hideContextMenu();
            this.closeThemePanel();
            if (id === this.rootId) return; // 루트는 이동 불가

            // 5px 이상 움직이면 즉시 드래그 시작(직관적), 안 움직여도 150ms 누르면 시작
            const startX = e.clientX, startY = e.clientY;
            let started = false;
            const begin = (ev) => {
                if (started) return;
                started = true;
                clearTimeout(this.dragStartTimer);
                window.removeEventListener('mousemove', moveHandler);
                this.startDrag(id, ev);
            };
            const moveHandler = (ev) => {
                if (Math.abs(ev.clientX - startX) + Math.abs(ev.clientY - startY) > 5) begin(ev);
            };
            this.dragStartTimer = setTimeout(() => begin(e), 150);
            const upHandler = () => {
                clearTimeout(this.dragStartTimer);
                window.removeEventListener('mousemove', moveHandler);
                window.removeEventListener('mouseup', upHandler);
            };
            window.addEventListener('mousemove', moveHandler);
            window.addEventListener('mouseup', upHandler);
        }

        startDrag(id, e) {
            this.dragNodeId = id;
            this.stopEditing();
            const node = this.nodes[id];
            const ghost = document.createElement('div');
            ghost.className = 'ghost-node';
            ghost.textContent = node.text;
            document.body.appendChild(ghost);
            this.dragGhost = ghost;
            this.updateDragGhost(e);
            const el = document.getElementById(id);
            if (el) el.classList.add('dragging');
        }

        updateDragGhost(e) {
            if (!this.dragGhost) return;
            this.dragGhost.style.left = e.clientX + 10 + 'px';
            this.dragGhost.style.top = e.clientY + 10 + 'px';

            this.dropTargetId = null;
            this.dropMode = null;
            document.querySelectorAll('.node.drop-target').forEach(el => el.classList.remove('drop-target'));

            const els = document.elementsFromPoint(e.clientX, e.clientY);
            const targetEl = els.find(el => el.classList.contains('node') && el.id !== this.dragNodeId);
            if (!targetEl) { this.hideDropIndicator(); return; }

            const targetId = targetEl.id;
            const rect = targetEl.getBoundingClientRect();
            const rel = (e.clientY - rect.top) / rect.height; // 0(상단) ~ 1(하단)

            // 노드 위쪽 → 형제로 위에, 아래쪽 → 형제로 아래, 가운데 → 자식으로.
            // 루트는 형제가 없으므로 항상 자식.
            let mode;
            if (targetId === this.rootId) mode = 'child';
            else if (rel < 0.30) mode = 'before';
            else if (rel > 0.70) mode = 'after';
            else mode = 'child';

            this.dropTargetId = targetId;
            this.dropMode = mode;

            if (mode === 'child') {
                targetEl.classList.add('drop-target');
                this.hideDropIndicator();
            } else {
                this.showDropIndicator(rect, mode);
            }
        }

        showDropIndicator(rect, mode) {
            let ind = this.dropIndicator;
            if (!ind) {
                ind = document.createElement('div');
                ind.className = 'drop-indicator';
                document.body.appendChild(ind);
                this.dropIndicator = ind;
            }
            ind.style.display = 'block';
            ind.style.left = rect.left + 'px';
            ind.style.width = rect.width + 'px';
            ind.style.top = (mode === 'before' ? rect.top - 1 : rect.bottom - 1) + 'px';
        }

        hideDropIndicator() {
            if (this.dropIndicator) this.dropIndicator.style.display = 'none';
        }

        /** 재배치 후 컬러 인덱스를 새 부모 기준으로 재계산 (컬러 모드 일관성) */
        recomputeColorIdx(id) {
            const node = this.nodes[id];
            if (!node) return;
            if (node.parentId === this.rootId) {
                node.colorIdx = this.nodes[this.rootId].children.indexOf(id);
            } else if (this.nodes[node.parentId]) {
                node.colorIdx = this.nodes[node.parentId].colorIdx;
            }
            node.children.forEach(c => this.recomputeColorIdx(c));
        }

        endDrag(e) {
            if (this.dragGhost) this.dragGhost.remove();
            if (this.dragNodeId) {
                const dEl = document.getElementById(this.dragNodeId);
                if (dEl) dEl.classList.remove('dragging');
            }
            document.querySelectorAll('.node.drop-target').forEach(el => el.classList.remove('drop-target'));
            this.hideDropIndicator();

            const nodeId = this.dragNodeId;
            const targetId = this.dropTargetId;
            const mode = this.dropMode;
            this.dragNodeId = null;
            this.dragGhost = null;
            this.dropTargetId = null;
            this.dropMode = null;

            if (!nodeId || !targetId || nodeId === targetId) return;
            const movingNode = this.nodes[nodeId];
            const target = this.nodes[targetId];
            if (!movingNode || !target) return;

            // 순환 방지: target 이 moving 의 자손이면 거부
            let p = target;
            while (p) { if (p.id === nodeId) return; p = this.nodes[p.parentId]; }

            const detach = () => {
                const oldParent = this.nodes[movingNode.parentId];
                if (oldParent) oldParent.children = oldParent.children.filter(cid => cid !== nodeId);
            };

            if (mode === 'child') {
                detach();
                target.children.push(nodeId);
                movingNode.parentId = targetId;
                movingNode.customWidth = null;
                if (targetId === this.rootId) {
                    const rootEl = document.getElementById(this.rootId);
                    const rootRect = rootEl.getBoundingClientRect();
                    movingNode.direction = (e.clientX < rootRect.left + rootRect.width / 2) ? 'left' : 'right';
                } else {
                    movingNode.direction = target.direction;
                }
            } else {
                // before / after → target 의 형제로 삽입 (같은 계층 순서 변경 포함)
                const newParentId = target.parentId;
                if (!newParentId) return; // target 이 root 면 형제 불가
                detach();
                const newParent = this.nodes[newParentId];
                movingNode.parentId = newParentId;
                movingNode.customWidth = null;
                movingNode.direction = target.direction;
                let idx = newParent.children.indexOf(targetId);
                if (idx === -1) idx = newParent.children.length;
                if (mode === 'after') idx += 1;
                newParent.children.splice(idx, 0, nodeId);
            }

            this.recomputeColorIdx(nodeId);
            this.updateLayout();
            this.saveState();
        }

        /* ---------- minimap ---------- */
        renderMinimap() {
            if (!this.minimap || !this.prefs.minimap || !this.rootId) return;
            const cvs = this.minimap;
            const ctx = cvs.getContext('2d');
            const W = cvs.width, H = cvs.height;
            ctx.clearRect(0, 0, W, H);

            const ns = Object.values(this.nodes).filter(n => typeof n.x === 'number');
            if (!ns.length) return;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            ns.forEach(n => {
                minX = Math.min(minX, n.x);
                minY = Math.min(minY, n.y - n.height / 2);
                maxX = Math.max(maxX, n.x + (n.width || 40));
                maxY = Math.max(maxY, n.y + n.height / 2);
            });
            const pad = 30;
            const bw = (maxX - minX) + pad * 2, bh = (maxY - minY) + pad * 2;
            const scale = Math.min(W / bw, H / bh);
            const ox = (W - bw * scale) / 2 - (minX - pad) * scale;
            const oy = (H - bh * scale) / 2 - (minY - pad) * scale;
            this.mm = { scale, ox, oy };
            const tx = v => v * scale + ox;
            const ty = v => v * scale + oy;

            const accent = this.prefs.accent;
            ns.forEach(n => {
                ctx.fillStyle = (n.id === this.rootId) ? accent : 'rgba(140,140,150,0.65)';
                const x = tx(n.x), y = ty(n.y - n.height / 2);
                const w = Math.max(2, (n.width || 40) * scale), h = Math.max(2, n.height * scale);
                ctx.fillRect(x, y, w, h);
            });

            // 현재 보이는 영역(viewport) 사각형
            const vw = this.viewport.clientWidth, vh = this.viewport.clientHeight;
            const wx0 = (0 - this.view.x) / this.view.scale;
            const wy0 = (0 - this.view.y) / this.view.scale;
            const wx1 = (vw - this.view.x) / this.view.scale;
            const wy1 = (vh - this.view.y) / this.view.scale;
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(tx(wx0), ty(wy0), (wx1 - wx0) * scale, (wy1 - wy0) * scale);
        }

        minimapJump(e) {
            if (!this.mm) return;
            const rect = this.minimap.getBoundingClientRect();
            const cx = (e.clientX - rect.left) * (this.minimap.width / rect.width);
            const cy = (e.clientY - rect.top) * (this.minimap.height / rect.height);
            const worldX = (cx - this.mm.ox) / this.mm.scale;
            const worldY = (cy - this.mm.oy) / this.mm.scale;
            this.view.x = this.viewport.clientWidth / 2 - worldX * this.view.scale;
            this.view.y = this.viewport.clientHeight / 2 - worldY * this.view.scale;
            this.updateViewTransform();
        }

        /* ---------- export PNG ---------- */
        // html2canvas 는 overflow 가 보이는 1×1 SVG(연결선)를 캡처하지 못하므로,
        // 노드는 투명 배경으로 캡처하고 연결선은 캔버스에 직접 그려 합성한다.
        async exportPNG() {
            if (typeof html2canvas === 'undefined') {
                this.showToast('내보내기 모듈을 불러오지 못했습니다 (네트워크 확인).', 'error');
                return;
            }
            if (!this.rootId) return;
            this.showToast('이미지를 생성하는 중…', 'info');

            this.updateLayout(); // 최신 좌표/크기 확보

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            Object.values(this.nodes).forEach(n => {
                if (!document.getElementById(n.id)) return; // 접힌 노드 제외
                minX = Math.min(minX, n.x);
                minY = Math.min(minY, n.y - n.height / 2);
                maxX = Math.max(maxX, n.x + n.width);
                maxY = Math.max(maxY, n.y + n.height / 2);
            });
            const pad = 60, scale = 2;
            const w = (maxX - minX) + pad * 2;
            const h = (maxY - minY) + pad * 2;
            const originX = minX - pad, originY = minY - pad;
            const mapX = wx => (wx - originX) * scale;
            const mapY = wy => (wy - originY) * scale;

            const prev = { ...this.view };
            this.view = { x: 0, y: 0, scale: 1 };
            this.render();
            const bg = getComputedStyle(document.body).backgroundColor;
            const lineColor = (getComputedStyle(document.body).getPropertyValue('--line-color') || '#C7C7CC').trim();

            try {
                // 1) 노드만 투명 배경으로 캡처
                const nodeCanvas = await html2canvas(this.nodesLayer, {
                    backgroundColor: null,
                    x: originX, y: originY, width: w, height: h,
                    scale, useCORS: true, logging: false
                });

                // 2) 합성: 배경 → 연결선 → 노드
                const out = document.createElement('canvas');
                out.width = Math.round(w * scale);
                out.height = Math.round(h * scale);
                const ctx = out.getContext('2d');
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, out.width, out.height);

                ctx.lineWidth = 2 * scale;
                ctx.lineCap = 'round';
                Object.values(this.nodes).forEach(n => {
                    const p = this.nodes[n.parentId];
                    if (!p) return;
                    if (!document.getElementById(n.id)) return; // 접힌 자식 제외
                    ctx.strokeStyle = n.color ? this.darken(n.color, 0.12)
                        : (this.isColorMode ? this.paletteColor(n.colorIdx, n.depth || 1).stroke : lineColor);
                    this.strokeLinkOnCanvas(ctx, p, n, mapX, mapY);
                });

                ctx.drawImage(nodeCanvas, 0, 0);

                const link = document.createElement('a');
                link.download = (this.docTitle || 'MinimalMind') + '.png';
                link.href = out.toDataURL('image/png');
                link.click();
                this.showToast('PNG로 내보냈습니다.', 'success');
            } catch (err) {
                this.showToast('내보내기에 실패했습니다.', 'error');
            } finally {
                this.view = prev;
                this.render();
            }
        }

        /* ---------- keyboard on node ---------- */
        handleKey(e) {
            if (this.editingId) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); e.stopPropagation();
                    this.stopEditing();
                }
                if (e.key === 'Tab') {
                    e.preventDefault(); e.stopPropagation();
                    this.stopEditing();
                    this.action('addChild');
                }
                return;
            }

            switch (e.key) {
                case 'Tab': e.preventDefault(); this.action('addChild'); break;
                case 'Enter': e.preventDefault(); this.action('addSibling'); break;
                case 'Backspace':
                case 'Delete': this.deleteNode(this.selectedId); break;
                case ' ':
                case 'F2': e.preventDefault(); this.startEditing(this.selectedId); break;
                case 'ArrowRight': this.navigate('right'); break;
                case 'ArrowLeft': this.navigate('left'); break;
                case 'ArrowUp': this.navigate('up'); break;
                case 'ArrowDown': this.navigate('down'); break;
            }
        }

        navigate(dir) {
            if (!this.selectedId) return;
            const curr = this.nodes[this.selectedId];
            let nextId = null;

            if (curr.id === this.rootId) {
                if (dir === 'right') nextId = curr.children.find(c => this.nodes[c].direction !== 'left');
                else if (dir === 'left') nextId = curr.children.find(c => this.nodes[c].direction === 'left');
            } else {
                const isLeft = this.nodes[curr.id].direction === 'left';
                if (dir === 'right') {
                    if (isLeft) nextId = curr.parentId;
                    else if (curr.children.length > 0) nextId = curr.children[0];
                } else if (dir === 'left') {
                    if (isLeft && curr.children.length > 0) nextId = curr.children[0];
                    else nextId = curr.parentId;
                } else if (dir === 'up' || dir === 'down') {
                    const p = this.nodes[curr.parentId];
                    const sameSideSibs = p.children.filter(cid => this.nodes[cid].direction === curr.direction);
                    const idx = sameSideSibs.indexOf(this.selectedId);
                    if (dir === 'up' && idx > 0) nextId = sameSideSibs[idx - 1];
                    if (dir === 'down' && idx < sameSideSibs.length - 1) nextId = sameSideSibs[idx + 1];
                }
            }
            if (nextId) this.selectNode(nextId);
        }

        action(act) {
            if (act === 'addChild') {
                if (!this.selectedId) return;
                const newId = this.createNode(this.selectedId, "새 아이디어");
                this.nodes[this.selectedId].folded = false;
                this.updateLayout();
                this.selectNode(newId);
                this.startEditing(newId);
                this.saveState();
            } else if (act === 'addSibling') {
                if (!this.selectedId || this.selectedId === this.rootId) return;
                const parentId = this.nodes[this.selectedId].parentId;
                const newId = this.createNode(parentId, "새 아이디어");
                this.selectNode(newId);
                this.startEditing(newId);
                this.saveState();
            }
        }

        selectNode(id) {
            this.selectedId = id;
            this.render();
        }

        /* ---------- editing ---------- */
        startEditing(id) {
            this.editingId = id;
            this.render();
            setTimeout(() => {
                const el = document.getElementById(id);
                if (!el) return;
                el.classList.add('editing');
                const textEl = el.querySelector('.node-text');
                if (!textEl) return;
                textEl.contentEditable = true;
                textEl.focus();
                // execCommand('selectAll') deprecated → Selection API
                const range = document.createRange();
                range.selectNodeContents(textEl);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }, 50);
        }

        stopEditing() {
            if (!this.editingId) return;
            const el = document.getElementById(this.editingId);
            if (el) {
                const textEl = el.querySelector('.node-text');
                if (textEl) {
                    this.nodes[this.editingId].text = textEl.innerText;
                    textEl.contentEditable = false;
                    textEl.blur();
                }
                el.classList.remove('editing');
                this.updateLayout();
            }

            const currentId = this.editingId;
            // 루트 노드를 편집했으면 상단 타이틀과 동기화
            if (currentId === this.rootId && this.nodes[currentId]) {
                this.docTitle = this.nodes[currentId].text || "Untitled Project";
                this.titleInput.value = this.docTitle;
            }
            this.editingId = null;
            this.render();
            this.saveState();

            setTimeout(() => {
                const nodeEl = document.getElementById(currentId);
                if (nodeEl) nodeEl.focus();
            }, 10);
        }

        /* ---------- view ---------- */
        resetZoom() { this.view.scale = 1; this.centerView(); }

        zoomToFit() {
            if (!this.rootId) return;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            Object.values(this.nodes).forEach(n => {
                minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
                maxX = Math.max(maxX, n.x + n.width); maxY = Math.max(maxY, n.y + n.height);
            });
            const padding = 100;
            const scale = Math.min(
                this.viewport.clientWidth / (maxX - minX + padding * 2),
                this.viewport.clientHeight / (maxY - minY + padding * 2),
                1.5
            );
            this.view.scale = Math.max(0.1, scale);
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            this.view.x = (this.viewport.clientWidth / 2) - (centerX * this.view.scale);
            this.view.y = (this.viewport.clientHeight / 2) - (centerY * this.view.scale);
            this.updateViewTransform();
        }

        centerView() {
            if (!this.rootId) return;
            const node = this.nodes[this.rootId];
            this.view.x = this.viewport.clientWidth / 2 - node.width / 2 - node.x;
            this.view.y = this.viewport.clientHeight / 2 - node.y;
            this.updateViewTransform();
        }

        centerOnNode(id) {
            const n = this.nodes[id];
            if (!n) return;
            this.view.x = this.viewport.clientWidth / 2 - (n.x + n.width / 2) * this.view.scale;
            this.view.y = this.viewport.clientHeight / 2 - n.y * this.view.scale;
            this.updateViewTransform();
        }

        /* ---------- persistence ---------- */
        currentDocument() {
            return {
                nodes: this.nodes,
                rootId: this.rootId,
                docTitle: this.docTitle,
                isColorMode: this.isColorMode,
            };
        }

        saveFile(filename) {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.currentDocument()));
            const anchor = document.createElement('a');
            anchor.href = dataStr;
            anchor.download = filename;
            anchor.click();
        }

        // docString: saveState 가 이미 만든 JSON 문자열(있으면 재직렬화 생략)
        saveToStorage(docString) {
            let result;
            if (!this.activeProjectId) {
                // 첫 저장 → 새 프로젝트 생성
                const id = this.store.createProject(this.currentDocument(), this.docTitle);
                if (id) { this.activeProjectId = id; result = { ok: true }; }
                else result = { ok: false, reason: 'unknown' };
            } else if (docString) {
                result = this.store.saveProjectRaw(this.activeProjectId, docString, this.docTitle);
            } else {
                result = this.store.saveProject(this.activeProjectId, this.currentDocument(), this.docTitle);
            }
            if (result.ok) {
                this.showSaveIndicator();
                if (this.cloud.isEnabled()) this.cloud.scheduleSync(() => this.store.exportBundle());
            } else if (result.reason === 'quota') {
                this.showToast('저장 공간이 가득 찼습니다. 이미지를 줄이거나 파일로 내보내세요.', 'error');
            } else {
                this.showToast('자동 저장에 실패했습니다.', 'error');
            }
        }

        showSaveIndicator() {
            this.saveIndicator.classList.add('show');
            if (this.saveTimer) clearTimeout(this.saveTimer);
            this.saveTimer = setTimeout(() => this.saveIndicator.classList.remove('show'), 1500);
        }

        loadFromStorage() {
            this.store.migrateLegacy(); // 기존 단일 문서 자동 이전
            const list = this.store.listProjects();
            let activeId = this.store.getActiveId();
            if (!activeId || !list.find(p => p.id === activeId)) {
                activeId = list.length ? list[0].id : null;
            }
            if (activeId) {
                const doc = this.store.loadProject(activeId);
                if (doc) {
                    this.activeProjectId = activeId;
                    this.store.setActiveId(activeId);
                    this.nodes = doc.nodes;
                    this.rootId = doc.rootId;
                    this.docTitle = doc.docTitle;
                    this.isColorMode = doc.isColorMode;
                    return;
                }
            }
            this.activeProjectId = null; // 없으면 init()의 reset()이 새 프로젝트로 시작
        }

        loadFile(input) {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                let parsed;
                try {
                    parsed = JSON.parse(e.target.result);
                } catch (err) {
                    this.showToast('파일을 읽을 수 없습니다 (JSON 오류).', 'error');
                    input.value = '';
                    return;
                }
                const doc = Sec.sanitizeDocument(parsed);
                if (!doc) {
                    this.showToast('올바른 MinimalMind 파일이 아닙니다.', 'error');
                    input.value = '';
                    return;
                }
                this.saveToStorage();          // 현재 프로젝트 보존
                this.nodes = doc.nodes;
                this.rootId = doc.rootId;
                this.docTitle = doc.docTitle || file.name.replace(/\.json$/i, '');
                this.isColorMode = doc.isColorMode;
                this.titleInput.value = this.docTitle;
                this.history = []; this.historyIdx = -1;
                this.selectedId = null; this.editingId = null;
                this.activeProjectId = null;   // 가져온 파일은 새 프로젝트로 저장
                this.nodesLayer.innerHTML = '';
                this.updateColorModeUI();
                this.updateLayout();
                this.centerView();
                this.saveState();
                this.showToast('새 프로젝트로 불러왔습니다.', 'success');
                input.value = ''; // 같은 파일 재선택 허용
            };
            reader.readAsText(file);
        }

        reset() {
            if (this.rootId && !confirm("초기화 하시겠습니까? 현재 작업이 사라집니다.")) return;
            this.nodes = {};
            this.rootId = null;
            this.history = [];
            this.historyIdx = -1;
            this.docTitle = this.randomTitles[Math.floor(Math.random() * this.randomTitles.length)];
            this.titleInput.value = this.docTitle;
            this.createNode(null, this.docTitle);
            this.updateLayout();
            this.centerView();
            this.saveState();
        }

        /* ---------- projects (다중 프로젝트 갤러리) ---------- */
        openProjects() {
            this.stopEditing();
            this.saveToStorage();          // 현재 작업 저장 + 인덱스 갱신
            this.renderProjectGallery();
            this.projectsModal.classList.add('active');
        }
        closeProjects() { this.projectsModal.classList.remove('active'); }

        newProject() {
            this.saveToStorage();
            this._freshProjectInternal();
            this.closeProjects();
            this.showToast('새 프로젝트를 만들었습니다.', 'success');
        }

        _freshProjectInternal() {
            const title = this.randomTitles[Math.floor(Math.random() * this.randomTitles.length)];
            this.nodes = {}; this.rootId = null;
            this.history = []; this.historyIdx = -1;
            this.selectedId = null; this.editingId = null;
            this.docTitle = title; this.titleInput.value = title;
            this.activeProjectId = null;   // 첫 저장 시 새 프로젝트 생성됨
            this.nodesLayer.innerHTML = '';
            this.createNode(null, title);
            this.updateLayout();
            this.centerView();
            this.saveState();
        }

        openProject(id) {
            if (id === this.activeProjectId) { this.closeProjects(); return; }
            this.saveToStorage();          // 현재 작업 보존 후 전환
            this._loadProjectInternal(id);
            this.closeProjects();
        }

        _loadProjectInternal(id) {
            const doc = this.store.loadProject(id);
            if (!doc) { this.showToast('프로젝트를 열 수 없습니다.', 'error'); return; }
            this.activeProjectId = id;
            this.store.setActiveId(id);
            this.nodes = doc.nodes; this.rootId = doc.rootId;
            this.docTitle = doc.docTitle; this.isColorMode = doc.isColorMode;
            this.titleInput.value = this.docTitle;
            this.history = []; this.historyIdx = -1;
            this.selectedId = null; this.editingId = null;
            this.nodesLayer.innerHTML = '';
            this.updateColorModeUI();
            this.render(); this.updateLayout(); this.centerView();
            this.saveState();
        }

        duplicateProjectAction(id) {
            const nid = this.store.duplicateProject(id);
            if (nid) { this.renderProjectGallery(); this.showToast('복제했습니다.', 'success'); }
            else this.showToast('복제에 실패했습니다.', 'error');
        }

        // 인라인 이름 변경 (prompt 미사용 — 차단 환경에서도 동작)
        startRename(id, titleEl) {
            const cur = this.store.listProjects().find(p => p.id === id);
            const old = cur ? cur.title : (titleEl.textContent || '');
            const input = document.createElement('input');
            input.className = 'proj-rename-input';
            input.value = old;
            let done = false;
            const commit = (save) => {
                if (done) return; done = true;
                const name = input.value.trim();
                if (save && name) {
                    this.store.renameProject(id, name);
                    if (id === this.activeProjectId) {
                        this.docTitle = name;
                        this.titleInput.value = name;
                        if (this.nodes[this.rootId]) this.nodes[this.rootId].text = name;
                        this.render();
                    }
                }
                this.renderProjectGallery();
            };
            input.onclick = (e) => e.stopPropagation();
            input.onkeydown = (e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commit(true);
                else if (e.key === 'Escape') commit(false);
            };
            input.onblur = () => commit(true);
            titleEl.innerHTML = '';
            titleEl.appendChild(input);
            input.focus();
            input.select();
        }

        deleteProjectAction(id) {
            if (!confirm('이 프로젝트를 삭제할까요? 되돌릴 수 없습니다.')) return;
            const wasActive = (id === this.activeProjectId);
            const others = this.store.listProjects().filter(p => p.id !== id);
            this.store.deleteProject(id);
            if (wasActive) {
                this.activeProjectId = null;   // 삭제된 현재 메모리 상태 버림
                if (others.length) this._loadProjectInternal(others[0].id);
                else this._freshProjectInternal();
            }
            this.renderProjectGallery();
            this.showToast('삭제했습니다.', 'success');
        }

        formatDate(ts) {
            if (!ts) return '';
            const d = new Date(ts), p = n => String(n).padStart(2, '0');
            return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
        }

        drawProjectThumb(canvas, doc) {
            const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height;
            ctx.clearRect(0, 0, W, H);
            const ns = Object.values(doc.nodes || {});
            if (!ns.length) return;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            ns.forEach(n => {
                const w = n.width || 80, h = n.height || 30;
                minX = Math.min(minX, n.x); minY = Math.min(minY, n.y - h / 2);
                maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h / 2);
            });
            const pad = 18, bw = (maxX - minX) + pad * 2, bh = (maxY - minY) + pad * 2;
            const scale = Math.min(W / bw, H / bh);
            const ox = (W - bw * scale) / 2 - (minX - pad) * scale;
            const oy = (H - bh * scale) / 2 - (minY - pad) * scale;
            const tx = v => v * scale + ox, ty = v => v * scale + oy;
            ctx.strokeStyle = 'rgba(150,150,160,0.5)'; ctx.lineWidth = 1;
            ns.forEach(n => {
                const p = doc.nodes[n.parentId]; if (!p) return;
                ctx.beginPath();
                ctx.moveTo(tx(p.x + (p.width || 80) / 2), ty(p.y));
                ctx.lineTo(tx(n.x + (n.width || 80) / 2), ty(n.y));
                ctx.stroke();
            });
            ns.forEach(n => {
                const w = n.width || 80, h = n.height || 30;
                ctx.fillStyle = n.color || (n.id === doc.rootId ? '#8e8e93' : 'rgba(120,120,135,0.85)');
                ctx.fillRect(tx(n.x), ty(n.y - h / 2), Math.max(2, w * scale), Math.max(2, h * scale));
            });
        }

        renderProjectGallery() {
            const list = this.store.listProjects();
            const grid = document.getElementById('project-grid');
            grid.innerHTML = '';
            if (!list.length) {
                grid.innerHTML = '<div class="proj-empty">프로젝트가 없습니다. “+ 새 프로젝트”로 시작하세요.</div>';
                return;
            }
            list.forEach(p => {
                const card = document.createElement('div');
                card.className = 'proj-card' + (p.id === this.activeProjectId ? ' active' : '');

                const cv = document.createElement('canvas');
                cv.width = 240; cv.height = 140; cv.className = 'proj-thumb';
                const doc = this.store.loadProject(p.id);
                if (doc) this.drawProjectThumb(cv, doc);
                card.appendChild(cv);

                const info = document.createElement('div'); info.className = 'proj-info';
                const t = document.createElement('div'); t.className = 'proj-title'; t.textContent = p.title || 'Untitled';
                if (p.id === this.activeProjectId) {
                    const badge = document.createElement('span'); badge.className = 'proj-badge'; badge.textContent = '열림'; t.appendChild(badge);
                }
                const d = document.createElement('div'); d.className = 'proj-date'; d.textContent = this.formatDate(p.updatedAt);
                info.appendChild(t); info.appendChild(d); card.appendChild(info);

                const actions = document.createElement('div'); actions.className = 'proj-actions';
                const mk = (label, title, fn) => {
                    const b = document.createElement('button'); b.textContent = label; b.title = title;
                    b.onclick = (e) => { e.stopPropagation(); fn(); }; return b;
                };
                actions.appendChild(mk('✏️', '이름 변경', () => this.startRename(p.id, t)));
                actions.appendChild(mk('⧉', '복제', () => this.duplicateProjectAction(p.id)));
                actions.appendChild(mk('🗑️', '삭제', () => this.deleteProjectAction(p.id)));
                card.appendChild(actions);

                t.ondblclick = (e) => { e.stopPropagation(); this.startRename(p.id, t); };
                card.onclick = () => this.openProject(p.id);
                grid.appendChild(card);
            });
        }

        /* ---------- cloud sync (Phase 2) ---------- */
        openCloudModal() {
            this.stopEditing();
            this._refreshCloudModal();
            this.cloudModal.classList.add('active');
            if (!this.cloud.isEnabled()) {
                const pw = document.getElementById('cloud-pw');
                pw.value = ''; setTimeout(() => pw.focus(), 50);
            }
        }
        closeCloudModal() { this.cloudModal.classList.remove('active'); }

        _refreshCloudModal() {
            const on = this.cloud.isEnabled();
            document.getElementById('cloud-disconnected').style.display = on ? 'none' : 'block';
            document.getElementById('cloud-connected').style.display = on ? 'block' : 'none';
            const ls = this.cloud.lastSync();
            document.getElementById('cloud-lastsync').textContent = ls ? this.formatDate(ls) : '아직 없음';
        }

        async cloudConnect() {
            const pw = document.getElementById('cloud-pw').value;
            if (!pw) { this.showToast('비밀번호를 입력하세요.', 'error'); return; }
            this.showToast('연결 중…', 'info');
            const r = await this.cloud.connect(pw);
            if (!r.ok) {
                const msg = r.reason === 'auth' ? '비밀번호가 올바르지 않습니다.'
                    : r.reason === 'server' ? '서버(백엔드)가 아직 설정되지 않았습니다.'
                        : '연결에 실패했습니다 (네트워크).';
                this.showToast(msg, 'error');
                return;
            }
            try {
                if (r.data) {
                    const activeChanged = this.store.importBundle(r.data);
                    await this.cloud.push(this.store.exportBundle()); // 양쪽 수렴
                    if (activeChanged) this._reloadActiveFromStore();
                } else {
                    await this.cloud.push(this.store.exportBundle());
                }
            } catch (e) { /* 상태로 표시 */ }
            this.updateCloudStatus('synced');
            this._refreshCloudModal();
            this.renderProjectGallery();
            this.showToast('동기화가 켜졌습니다.', 'success');
        }

        cloudDisconnect() {
            this.cloud.disconnect();
            this.updateCloudStatus('off');
            this._refreshCloudModal();
            this.showToast('동기화를 해제했습니다.', 'success');
        }

        async cloudSyncNow() { await this.cloudPullAndMerge(true); }

        async cloudPullAndMerge(notify) {
            if (!this.cloud.isEnabled()) return;
            this.updateCloudStatus('syncing');
            try {
                const remote = await this.cloud.pull();
                const activeChanged = remote ? this.store.importBundle(remote) : false;
                await this.cloud.push(this.store.exportBundle());
                if (activeChanged) this._reloadActiveFromStore();
                this.updateCloudStatus('synced');
                this._refreshCloudModal();
                if (notify) this.showToast('동기화 완료.', 'success');
            } catch (e) {
                this.updateCloudStatus('error');
                if (notify) this.showToast('동기화에 실패했습니다.', 'error');
            }
        }

        // 원격 병합으로 활성 프로젝트가 바뀌었을 때 화면 갱신
        _reloadActiveFromStore() {
            const doc = this.store.loadProject(this.activeProjectId);
            if (!doc) return;
            this.nodes = doc.nodes; this.rootId = doc.rootId;
            this.docTitle = doc.docTitle; this.isColorMode = doc.isColorMode;
            this.titleInput.value = this.docTitle;
            this.history = []; this.historyIdx = -1;
            this.selectedId = null; this.editingId = null;
            this.nodesLayer.innerHTML = '';
            this.updateColorModeUI();
            this.render(); this.updateLayout(); this.centerView();
            this.showToast('최신 버전을 불러왔습니다.', 'success');
        }

        updateCloudStatus(status) {
            const btn = document.getElementById('btn-cloud');
            if (btn) {
                let cls = 'icon-btn';
                if (status === 'error') cls += ' error';
                else if (status !== 'off') cls += ' connected';
                if (status === 'syncing') cls += ' syncing';
                btn.className = cls;
            }
            const lbl = document.getElementById('cloud-status');
            if (lbl) lbl.textContent = status === 'syncing' ? '동기화 중…' : status === 'error' ? '오류' : status === 'off' ? '꺼짐' : '연결됨';
        }
    }

    window.app = new MinimalMind();
})();
