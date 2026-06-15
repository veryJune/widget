/* ============================================================
 * MinimalMind — Security helpers
 * 모든 사용자 입력/외부 파일(.json)은 이 계층을 거쳐 안전화된다.
 *  - XSS 차단: 텍스트는 DOM textNode 로만 삽입, innerHTML 미사용
 *  - 이미지 src 화이트리스트 (data:image/*, http(s) 만 허용)
 *  - 불러온 문서 구조 검증/정규화 (sanitizeDocument)
 * ============================================================ */
window.MM = window.MM || {};

MM.Security = (function () {
    const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

    /** HTML 특수문자 escape (속성/텍스트 공용) */
    function escapeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /** 이미지 src 화이트리스트 검사 */
    function isSafeImageSrc(src) {
        if (typeof src !== 'string') return false;
        return /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(src)
            || /^https?:\/\//i.test(src);
    }

    /** 링크 href 안전화 (javascript: 등 차단) */
    function safeHref(url) {
        let u = String(url);
        if (u.startsWith('www.')) u = 'https://' + u;
        try {
            const parsed = new URL(u);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.href;
        } catch (e) { /* invalid */ }
        return null;
    }

    /** 체크박스 접두어 파싱 */
    function parseCheckbox(text) {
        if (text.startsWith('[] ')) return { state: 'unchecked', rest: text.slice(3) };
        if (text.startsWith('[x] ')) return { state: 'checked', rest: text.slice(4) };
        return { state: 'none', rest: text };
    }

    /**
     * 텍스트를 안전한 DOM 노드 배열로 변환 (URL은 링크 span 으로).
     * innerHTML 을 일절 쓰지 않으므로 XSS 불가능.
     */
    function buildRichTextNodes(text, linkColor) {
        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        let match;
        URL_REGEX.lastIndex = 0;
        while ((match = URL_REGEX.exec(text)) !== null) {
            if (match.index > lastIdx) {
                frag.appendChild(document.createTextNode(text.slice(lastIdx, match.index)));
            }
            const span = document.createElement('span');
            span.className = 'link-text';
            span.style.color = linkColor;
            span.style.textDecoration = 'underline';
            span.textContent = match[0];           // textContent → escape 자동
            frag.appendChild(span);
            lastIdx = match.index + match[0].length;
        }
        if (lastIdx < text.length) {
            frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        }
        return frag;
    }

    /**
     * 불러온 문서(localStorage/파일) 구조 검증 + 정규화.
     * 신뢰할 수 없는 입력을 안전한 형태로만 통과시킨다.
     * @returns {object|null} 정규화된 문서 또는 null(거부)
     */
    function sanitizeDocument(data) {
        if (!data || typeof data !== 'object') return null;
        if (!data.nodes || typeof data.nodes !== 'object') return null;
        if (typeof data.rootId !== 'string' || !data.nodes[data.rootId]) return null;

        const cleanNodes = {};
        for (const [id, raw] of Object.entries(data.nodes)) {
            if (!raw || typeof raw !== 'object') continue;
            if (typeof id !== 'string') continue;
            const node = {
                id: id,
                text: typeof raw.text === 'string' ? raw.text : '',
                parentId: (typeof raw.parentId === 'string') ? raw.parentId : null,
                children: Array.isArray(raw.children) ? raw.children.filter(c => typeof c === 'string') : [],
                x: Number(raw.x) || 0,
                y: Number(raw.y) || 0,
                width: Number(raw.width) || 0,
                height: Number(raw.height) || 0,
                customWidth: (raw.customWidth == null) ? null : Number(raw.customWidth),
                folded: !!raw.folded,
                colorIdx: Number(raw.colorIdx) || 0,
                direction: ['left', 'right', 'root'].includes(raw.direction) ? raw.direction : 'right',
            };
            // 이미지: 화이트리스트 통과한 것만 유지
            if (raw.image && isSafeImageSrc(raw.image)) node.image = raw.image;
            // 노드별 색상: 유효한 hex 만 유지
            if (typeof raw.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(raw.color)) node.color = raw.color;
            cleanNodes[id] = node;
        }
        if (!cleanNodes[data.rootId]) return null;

        // 깨진 참조 정리 (존재하지 않는 child 제거)
        for (const node of Object.values(cleanNodes)) {
            node.children = node.children.filter(cid => cleanNodes[cid]);
        }

        return {
            nodes: cleanNodes,
            rootId: data.rootId,
            docTitle: (typeof data.docTitle === 'string' && data.docTitle.trim()) ? data.docTitle : 'Untitled Project',
            isColorMode: !!data.isColorMode,
        };
    }

    return {
        escapeHTML,
        isSafeImageSrc,
        safeHref,
        parseCheckbox,
        buildRichTextNodes,
        sanitizeDocument,
        URL_REGEX,
    };
})();
