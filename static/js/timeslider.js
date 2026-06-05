'use strict';

// Read-only comments for the timeslider / in-place history view.
//
// This file is loaded as a plain <script> injected by eejsBlock_timesliderScripts
// — NOT as a client hook — because older Etherpad timeslider bundles cannot load
// plugin client hooks ("Dynamic require ... is not supported"). It therefore uses
// no require(): socket.io comes from the global `io` (the server-served client,
// injected just before this script).
//
// On Etherpad cores whose timeslider runs the plugin's aceAttribsToClasses, the
// commented text already carries the `comment` class and we just render the
// sidebar against it. On older cores it does not, so we ask the server for each
// comment's character ranges at the displayed revision (getCommentLocations) and
// wrap them in `.comment` spans ourselves — after which the rest is identical.

(() => {
  const io = window.io;
  if (!io) return; // socket.io client not present — nothing we can do

  let socket = null;
  let comments = {}; // commentId -> data
  let built = false;
  let padId = null;

  const root = () => document.location.pathname.split('/p/')[0];

  const getPadId = () => {
    const cv = window.clientVars;
    if (cv && cv.padId) return cv.padId;
    return decodeURIComponent(document.location.pathname.split('/p/')[1].split('/')[0]);
  };

  const connect = () => {
    const loc = document.location;
    const port = loc.port || (loc.protocol === 'https:' ? 443 : 80);
    socket = io(`${loc.protocol}//${loc.hostname}:${port}/comment`, {
      path: `${root()}/socket.io`,
      query: `padId=${padId}`,
    });
  };

  // The server's handler acks error-first: respond(null, value).
  const send = (type, payload) => new Promise((resolve) => {
    let done = false;
    const finish = (_err, val) => { if (!done) { done = true; resolve(val || {}); } };
    try { socket.emit(type, payload, finish); } catch (_e) { finish(null, {}); }
    setTimeout(() => finish(null, {}), 15000);
  });

  // ---- "Show Comments" preference (same logic as the editor path) ----
  const parentBody = () => {
    try {
      return window.parent !== window && window.parent.document
        ? window.parent.document.body : null;
    } catch (_e) { return null; }
  };
  const resolveEnabled = () => {
    const pb = parentBody();
    if (pb) return pb.classList.contains('comments-active');
    try {
      const cv = window.clientVars || {};
      const cp = cv.cookiePrefix || '';
      const name = document.location.protocol === 'https:' ? 'prefs' : 'prefsHttp';
      const cookie = document.cookie.split('; ');
      const raw = (cookie.find((c) => c.startsWith(`${cp}${name}=`)) ||
          cookie.find((c) => c.startsWith(`${name}=`)) || '').split('=')[1];
      if (raw) {
        const prefs = JSON.parse(decodeURIComponent(raw));
        if (typeof prefs.comments === 'boolean') return prefs.comments;
      }
    } catch (_e) { /* fall through */ }
    return true;
  };

  // ---- sidebar DOM + styling ----
  const injectCss = () => {
    [`${root()}/static/plugins/ep_comments_page/static/css/comment.css`,
      `${root()}/static/plugins/ep_comments_page/static/css/commentIcon.css`].forEach((href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    });
    const style = document.createElement('style');
    style.textContent = `
      #editorcontainerbox { position: relative; }
      #comments.ts-comments {
        position: absolute; top: 0; right: 0; width: 250px; height: 0;
        margin: 0; z-index: 5; display: block;
      }
      @media (max-width: 1180px) { #comments.ts-comments { display: none; } }
      #comments.ts-comments .sidebar-comment { right: 8px; cursor: default; }
      #comments.ts-comments .comment-actions-wrapper,
      #comments.ts-comments .comment-reply,
      #comments.ts-comments .new-comment,
      #comments.ts-comments .approve-suggestion-btn,
      #comments.ts-comments .revert-suggestion-btn { display: none !important; }
      #comments.ts-comments .change-accepted .from-value {
        text-decoration: line-through; opacity: .6;
      }
      #innerdocbody .comment.ts-related { background-color: #ffd54f !important; }
      #comments.ts-comments .sidebar-comment.ts-related {
        outline: 2px solid #ffb300; outline-offset: 1px;
      }
      body.ts-comments-hidden #comments.ts-comments { display: none; }
      body.ts-comments-hidden #innerdocbody .ace-line .comment {
        background-color: transparent !important; color: inherit !important;
      }`;
    document.head.appendChild(style);
  };

  const buildSidebar = () => {
    if (built) return;
    const box = document.getElementById('editorcontainerbox');
    if (!box) { window.requestAnimationFrame(buildSidebar); return; }
    built = true;
    injectCss();
    let container = document.getElementById('comments');
    if (!container) {
      container = document.createElement('div');
      container.id = 'comments';
      box.appendChild(container);
    }
    container.classList.add('ts-comments', 'active');
    scheduleSync();
  };

  // ---- comment-span reconstruction (cores without aceAttribsToClasses) ----
  // Wrap chars [start,end) of a line element in <span class="comment c-id">,
  // splitting text nodes as needed so a range spanning multiple author spans
  // still gets fully classed.
  const wrapRange = (lineEl, start, end, commentId) => {
    const walker = document.createTreeWalker(lineEl, NodeFilter.SHOW_TEXT, null);
    const segs = [];
    let offset = 0;
    let n;
    while ((n = walker.nextNode())) {
      segs.push({node: n, s: offset, e: offset + n.nodeValue.length});
      offset += n.nodeValue.length;
    }
    for (const seg of segs) {
      const s = Math.max(start, seg.s);
      const e = Math.min(end, seg.e);
      if (s >= e) continue;
      let node = seg.node;
      const localEnd = e - seg.s;
      const localStart = s - seg.s;
      if (localEnd < node.nodeValue.length) node.splitText(localEnd);
      if (localStart > 0) node = node.splitText(localStart);
      const span = document.createElement('span');
      span.className = `comment ${commentId}`;
      node.parentNode.insertBefore(span, node);
      span.appendChild(node);
    }
  };

  const currentRev = () => {
    const m = /^#(\d+)$/.exec(document.location.hash || '');
    return m ? Number(m[1]) : undefined; // undefined -> server uses head
  };

  // If the displayed revision's text has no `.comment` spans, fetch the comment
  // char-ranges for that revision and wrap them. Returns true if it wrapped.
  const ensureCommentSpans = async () => {
    if (document.querySelector('#innerdocbody .comment')) return false;
    const res = await send('getCommentLocations', {padId, rev: currentRev()});
    const locations = (res && res.locations) || {};
    if (document.querySelector('#innerdocbody .comment')) return false; // a hook beat us to it
    const lines = document.querySelectorAll('#innerdocbody > .ace-line, #innerdocbody > div');
    Object.keys(locations).forEach((commentId) => {
      locations[commentId].forEach(({line, start, end}) => {
        const lineEl = lines[line];
        if (lineEl) { try { wrapRange(lineEl, start, end, commentId); } catch (_e) { /* skip */ } }
      });
    });
    return true;
  };

  // ---- rendering (identical model to the editor sidebar) ----
  const setText = (el, cls, text) => {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = text || '';
    el.appendChild(span);
    return span;
  };
  const fmtDate = (ts) => {
    const num = Number(ts);
    if (!num) return '';
    try { return new Date(num).toLocaleString(); } catch (_e) { return ''; }
  };
  const buildSuggestion = (comment) => {
    const wrap = document.createElement('div');
    wrap.className = 'suggestion-display';
    setText(wrap, 'from-label', 'Suggested change from');
    setText(wrap, 'from-value', comment.changeFrom);
    setText(wrap, 'to-label', 'to');
    setText(wrap, 'to-value', comment.changeTo);
    return wrap;
  };
  const commentText = (parent, comment) => {
    if (comment.text && comment.text.length > 0) setText(parent, 'comment-text', comment.text);
    else setText(parent, 'comment-text default-text', 'Suggested Change');
  };
  const relate = (commentId, on) => {
    const box = document.getElementById(commentId);
    if (box) box.classList.toggle('ts-related', on);
    document.querySelectorAll(`#innerdocbody .${commentId}`)
        .forEach((span) => span.classList.toggle('ts-related', on));
  };
  const boxFor = (commentId, comment) => {
    const el = document.createElement('div');
    el.id = commentId;
    el.dataset.commentid = commentId;
    el.className = `sidebar-comment comment-container${comment.changeAccepted ? ' change-accepted' : ''}`;
    const compact = document.createElement('div');
    compact.className = 'compact-display-content';
    setText(compact, 'comment-author-name', comment.name);
    commentText(compact, comment);
    el.appendChild(compact);
    const full = document.createElement('div');
    full.className = 'full-display-content';
    const title = document.createElement('div');
    title.className = 'comment-title-wrapper';
    setText(title, 'comment-author-name', comment.name);
    setText(title, 'comment-created-at', fmtDate(comment.timestamp));
    commentText(title, comment);
    if (comment.changeTo) title.appendChild(buildSuggestion(comment));
    full.appendChild(title);
    el.appendChild(full);
    el.addEventListener('click', () => el.classList.toggle('full-display'));
    el.addEventListener('mouseenter', () => relate(commentId, true));
    el.addEventListener('mouseleave', () => relate(commentId, false));
    return el;
  };

  const presentComments = () => {
    const result = [];
    const seen = new Set();
    document.querySelectorAll('#innerdocbody .comment').forEach((span) => {
      const m = /(?:^| )(c-[A-Za-z0-9]+)/.exec(span.className || '');
      if (m && m[1] && !seen.has(m[1])) { seen.add(m[1]); result.push({id: m[1], span}); }
    });
    return result;
  };

  const render = () => {
    const container = document.getElementById('comments');
    if (!container) return;
    container.textContent = '';
    const on = resolveEnabled();
    document.body.classList.toggle('ts-comments-hidden', !on);
    if (!on) return;
    const present = presentComments().filter(({id}) => comments[id]);
    const placed = present.map(({id, span}) => {
      const el = boxFor(id, comments[id]);
      el.style.top = `${span.offsetTop}px`;
      container.appendChild(el);
      return {el, top: span.offsetTop};
    });
    let prevBottom = -Infinity;
    placed.forEach((p) => {
      let top = p.top;
      if (top < prevBottom + 6) top = prevBottom + 6;
      p.el.style.top = `${top}px`;
      prevBottom = top + p.el.offsetHeight;
    });
  };

  // ---- sync loop: reconstruct spans (if needed) then render ----
  let syncing = false;
  let rerun = false;
  const sync = async () => {
    if (syncing) { rerun = true; return; }
    syncing = true;
    try { await ensureCommentSpans(); render(); } catch (_e) { /* never break the timeslider */ }
    syncing = false;
    if (rerun) { rerun = false; scheduleSync(); }
  };
  let syncTimer = null;
  const scheduleSync = () => {
    if (syncTimer) return;
    syncTimer = window.setTimeout(() => { syncTimer = null; sync(); }, 80);
  };

  const commentIdOfNode = (node) => {
    const span = node && node.closest && node.closest('#innerdocbody .comment');
    if (!span) return null;
    const m = /(?:^| )(c-[A-Za-z0-9]+)/.exec(span.className || '');
    return m ? m[1] : null;
  };

  const observeContent = () => {
    const containerEl = document.getElementById('editorcontainerbox');
    if (!containerEl) { window.requestAnimationFrame(observeContent); return; }
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        const t = m.target;
        // Ignore our own #comments mutations and our own comment-span wrapping
        // (those are Elements with the `comment` class) to avoid a render loop.
        if (!(t instanceof Element)) { scheduleSync(); return; }
        if (t.closest('#comments')) continue;
        scheduleSync();
        return;
      }
    }).observe(containerEl, {childList: true, subtree: true});
    containerEl.addEventListener('mouseover', (e) => { const id = commentIdOfNode(e.target); if (id) relate(id, true); });
    containerEl.addEventListener('mouseout', (e) => { const id = commentIdOfNode(e.target); if (id) relate(id, false); });
    window.addEventListener('hashchange', scheduleSync);
    scheduleSync();
  };

  const start = async () => {
    try {
      padId = getPadId();
      buildSidebar();
      connect();
      observeContent();
      const load = async () => {
        const res = await send('getComments', {padId});
        comments = (res && res.comments) || {};
        scheduleSync();
      };
      socket.on('connect', () => { load(); });
      await load();
      const pb = parentBody();
      if (pb) new MutationObserver(scheduleSync).observe(pb, {attributes: true, attributeFilter: ['class']});
      socket.on('pushAddComment', (id, c) => { comments[id] = c; scheduleSync(); });
      socket.on('commentDeleted', (id) => { delete comments[id]; scheduleSync(); });
      socket.on('textCommentUpdated', (id, t) => { if (comments[id]) { comments[id].text = t; scheduleSync(); } });
      socket.on('changeAccepted', (id) => { if (comments[id]) { comments[id].changeAccepted = true; scheduleSync(); } });
      socket.on('changeReverted', (id) => { if (comments[id]) { comments[id].changeAccepted = false; scheduleSync(); } });
    } catch (_e) { /* fail silent */ }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
