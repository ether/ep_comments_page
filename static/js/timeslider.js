'use strict';

// Read-only comments for the timeslider / in-place history view.
//
// The editor-side EpComments class is tightly coupled to the ace_outer /
// ace_inner iframe structure, which does not exist in the timeslider (its
// #innerdocbody lives directly inside #editorcontainerbox). This module is a
// small, self-contained read-only renderer: it reuses the comment data socket
// (`/comment` namespace, `getComments`) and the plugin's own comment CSS, but
// owns its DOM and never wires any add/edit/delete/reply path.
//
// Each comment box is positioned at the vertical offset of the *first* inline
// `.comment` span carrying its id, mirroring the editor's sidebar, so it lines
// up with the text it annotates. #comments lives inside #editorcontainerbox
// (the timeslider's scroll container), so the boxes scroll with the content
// automatically. Only comments whose id is present in the displayed revision
// are shown, and the set is recomputed whenever the content changes, so they
// appear and disappear as the user scrubs.

const socketIoClient = require('socket.io-client');
const io = socketIoClient.default || socketIoClient;

let socket = null;
let comments = {}; // commentId -> comment data
let built = false;

const root = () => document.location.pathname.split('/p/')[0];

const padIdFromUrl = () => {
  const cv = window.clientVars;
  if (cv && cv.padId) return cv.padId;
  return decodeURIComponent(document.location.pathname.split('/p/')[1].split('/')[0]);
};

const connect = (padId) => {
  const loc = document.location;
  const port = loc.port || (loc.protocol === 'https:' ? 443 : 80);
  socket = io.connect(`${loc.protocol}//${loc.hostname}:${port}/comment`, {
    path: `${root()}/socket.io`,
    query: `padId=${padId}`,
  });
};

// The server's `handler` wrapper acks error-first: respond(null, value).
const send = (type, payload) => new Promise((resolve) => {
  let done = false;
  const finish = (_err, val) => { if (!done) { done = true; resolve(val || {}); } };
  try { socket.emit(type, payload, finish); } catch (_e) { finish(null, {}); }
  // Safety net so a broken socket never wedges the timeslider — but generous
  // enough to outlast a cold `/comment` namespace connect on a loaded CI
  // runner. A 5s ceiling let the very first getComments lose that race and
  // resolve `{}`, leaving comments permanently empty (no boxes); the server
  // acks quickly once connected, so a comment-less pad pays nothing for this.
  setTimeout(() => finish(null, {}), 15000);
});

// The outer pad body this timeslider is embedded in (in-place history mode),
// or null when the timeslider is top-level. Same-origin, so reachable.
const parentBody = () => {
  try {
    return window.parent !== window && window.parent.document ? window.parent.document.body : null;
  } catch (_e) { return null; }
};

// "Show Comments" preference. In in-place history the outer pad owns the toggle:
// ep_comments_page flips `comments-active` on its <body> the moment the user
// toggles, so the parent body class is the live, effective source of truth.
// In the standalone timeslider there is no toggle UI, so fall back to the prefs
// cookie that padToggle persists (settingId `comments`). Default on.
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

const injectCss = () => {
  [`${root()}/static/plugins/ep_comments_page/static/css/comment.css`,
    `${root()}/static/plugins/ep_comments_page/static/css/commentIcon.css`].forEach((href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  });
  // Timeslider-specific placement + read-only trimming. #comments normally lives
  // in a relative column in the editor; here we float it over the right gutter
  // of the scroll container and align boxes to their text by `top`.
  const style = document.createElement('style');
  style.textContent = `
    #editorcontainerbox { position: relative; }
    #comments.ts-comments {
      position: absolute; top: 0; right: 0; width: 250px; height: 0;
      margin: 0; z-index: 5; display: block;
    }
    @media (max-width: 1180px) { #comments.ts-comments { display: none; } }
    #comments.ts-comments .sidebar-comment { right: 8px; cursor: default; }
    /* Read-only: never show actions, replies, the new-comment form, or the
       accept/revert suggestion buttons. */
    #comments.ts-comments .comment-actions-wrapper,
    #comments.ts-comments .comment-reply,
    #comments.ts-comments .new-comment,
    #comments.ts-comments .approve-suggestion-btn,
    #comments.ts-comments .revert-suggestion-btn { display: none !important; }
    /* An accepted suggested change is "completed": strike the old text. */
    #comments.ts-comments .change-accepted .from-value {
      text-decoration: line-through; opacity: .6;
    }
    /* Two-way hover highlight between a comment box and its commented text. */
    #innerdocbody .comment.ts-related { background-color: #ffd54f !important; }
    #comments.ts-comments .sidebar-comment.ts-related {
      outline: 2px solid #ffb300; outline-offset: 1px;
    }
    /* Show Comments = off: hide the sidebar AND the inline highlight on the
       text, so commented passages read as plain text (the skin paints the
       highlight via #innerdocbody .ace-line .comment). */
    body.ts-comments-hidden #comments.ts-comments { display: none; }
    body.ts-comments-hidden #innerdocbody .ace-line .comment {
      background-color: transparent !important; color: inherit !important;
    }`;
  document.head.appendChild(style);
};

const buildSidebar = () => {
  if (built) return;
  // Retry until #editorcontainerbox exists rather than disabling permanently —
  // postTimesliderInit can run before the timeslider DOM is fully in place.
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
  container.classList.add('ts-comments', 'active'); // .active defeats #comments:not(.active){display:none}
  scheduleRender();
};

const setText = (el, cls, text) => {
  const span = document.createElement('span');
  span.className = cls;
  span.textContent = text || '';
  el.appendChild(span);
  return span;
};

const fmtDate = (ts) => {
  const n = Number(ts);
  if (!n) return '';
  try { return new Date(n).toLocaleString(); } catch (_e) { return ''; }
};

// Localize any data-l10n-id descendants if html10n is available (it is in the
// timeslider). Falls back to the textContent set at build time.
const localize = (el) => {
  const h = window.html10n;
  if (h && typeof h.translateElement === 'function') {
    try { h.translateElement(h.translations, el); } catch (_e) { /* keep fallback text */ }
  }
};

// A label/value span pair, with an l10n id on the label so it follows the UI
// language (English fallback baked in as textContent).
const setL10n = (parent, cls, l10nId, fallback) => {
  const span = setText(parent, cls, fallback);
  if (l10nId) span.dataset.l10nId = l10nId;
  return span;
};

// The suggested-change block (changeFrom → changeTo), styled by comment.css.
// When the suggestion was accepted, the box carries `change-accepted`, which
// strikes the "from" value (see injected CSS) to mark it completed.
const buildSuggestion = (comment) => {
  const wrap = document.createElement('div');
  wrap.className = 'suggestion-display';
  setL10n(wrap, 'from-label', 'ep_comments_page.comments_template.suggested_change_from_label',
      'Suggested change from');
  setText(wrap, 'from-value', comment.changeFrom);
  setL10n(wrap, 'to-label', 'ep_comments_page.comments_template.suggest_change_to_label', 'to');
  setText(wrap, 'to-value', comment.changeTo);
  return wrap;
};

const commentTextInto = (parent, comment) => {
  if (comment.text && comment.text.length > 0) {
    setText(parent, 'comment-text', comment.text);
  } else {
    setL10n(parent, 'comment-text default-text',
        'ep_comments_page.comments_template.suggested_change', 'Suggested Change');
  }
};

// Build a read-only .sidebar-comment box matching the editor markup so the
// shared comment.css styles it identically (compact by default, click to
// expand to the full view). No action/reply controls are ever created.
const boxFor = (commentId, comment) => {
  const el = document.createElement('div');
  el.id = commentId;
  el.dataset.commentid = commentId;
  el.className = `sidebar-comment comment-container${comment.changeAccepted ? ' change-accepted' : ''}`;

  const compact = document.createElement('div');
  compact.className = 'compact-display-content';
  setText(compact, 'comment-author-name', comment.name);
  commentTextInto(compact, comment);
  el.appendChild(compact);

  const full = document.createElement('div');
  full.className = 'full-display-content';
  const title = document.createElement('div');
  title.className = 'comment-title-wrapper';
  setText(title, 'comment-author-name', comment.name);
  setText(title, 'comment-created-at', fmtDate(comment.timestamp));
  commentTextInto(title, comment);
  if (comment.changeTo) title.appendChild(buildSuggestion(comment));
  full.appendChild(title);
  el.appendChild(full);

  // Click expands to the full read-only view. Hovering the box highlights the
  // text it annotates (the inverse — text → box — is wired once in render()).
  el.addEventListener('click', () => el.classList.toggle('full-display'));
  el.addEventListener('mouseenter', () => relate(commentId, true));
  el.addEventListener('mouseleave', () => relate(commentId, false));
  localize(el);
  return el;
};

// Toggle the two-way highlight class on a comment's box and all of its inline
// spans in the displayed revision.
const relate = (commentId, on) => {
  const box = document.getElementById(commentId);
  if (box) box.classList.toggle('ts-related', on);
  document.querySelectorAll(`#innerdocbody .${commentId}`)
      .forEach((span) => span.classList.toggle('ts-related', on));
};

// First inline span (with offsetTop) for each unique c-XXXX id in the displayed
// revision, in document order.
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
  // Resolve the preference fresh on every render so a late/early flip of the
  // outer pad's comments-active class can never leave us out of sync. When off,
  // the body class hides both the sidebar and the inline text highlight.
  const on = resolveEnabled();
  document.body.classList.toggle('ts-comments-hidden', !on);
  if (!on) return;
  const present = presentComments().filter(({id}) => comments[id]);
  // First pass: place each box at its text's offsetTop.
  const placed = present.map(({id, span}) => {
    const el = boxFor(id, comments[id]);
    el.style.top = `${span.offsetTop}px`;
    container.appendChild(el);
    return {el, top: span.offsetTop};
  });
  // Second pass: avoid overlap — push a box down if it would cover the one above.
  let prevBottom = -Infinity;
  placed.forEach((p) => {
    let top = p.top;
    if (top < prevBottom + 6) top = prevBottom + 6;
    p.el.style.top = `${top}px`;
    prevBottom = top + p.el.offsetHeight;
  });
};

// Re-render whenever the displayed content changes. onSlider fires *before*
// broadcast.ts re-renders #innerdocbody, so a MutationObserver (which fires
// after the content settles) is what keeps the boxes in sync as the user scrubs.
let renderTimer = null;
const scheduleRender = () => {
  if (renderTimer) return;
  renderTimer = window.setTimeout(() => { renderTimer = null; render(); }, 60);
};
const commentIdOfNode = (node) => {
  const span = node && node.closest && node.closest('#innerdocbody .comment');
  if (!span) return null;
  const m = /(?:^| )(c-[A-Za-z0-9]+)/.exec(span.className || '');
  return m ? m[1] : null;
};

const observeContent = () => {
  // Observe the stable scroll container, not #innerdocbody itself: the
  // timeslider can (re)build #innerdocbody while loading the first revision, and
  // an observer bound to the original node would miss the content — and with it
  // the comment spans. Ignore mutations inside our own #comments sidebar so
  // re-rendering it doesn't loop.
  const container = document.getElementById('editorcontainerbox');
  if (!container) { window.requestAnimationFrame(observeContent); return; }
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (!(m.target instanceof Element) || !m.target.closest('#comments')) {
        scheduleRender();
        return;
      }
    }
  }).observe(container, {childList: true, subtree: true});
  // Inverse hover: hovering commented text highlights its sidebar box.
  container.addEventListener('mouseover', (e) => { const id = commentIdOfNode(e.target); if (id) relate(id, true); });
  container.addEventListener('mouseout', (e) => { const id = commentIdOfNode(e.target); if (id) relate(id, false); });
  scheduleRender();
};

exports.postTimesliderInit = async () => {
  try {
    buildSidebar();
    const padId = padIdFromUrl();
    connect(padId);
    observeContent();
    // Fetch the comments now (the emit queues until the socket connects) and
    // again on every (re)connect, so a slow initial connection can't leave the
    // history view empty.
    const load = async () => {
      const res = await send('getComments', {padId});
      comments = (res && res.comments) || {};
      scheduleRender();
    };
    socket.on('connect', () => { load(); });
    await load();
    // Live "Show Comments" toggling: in in-place history the outer pad flips
    // `comments-active` on its <body> when the user toggles, so re-render
    // whenever that class changes (render() re-resolves the preference).
    const pb = parentBody();
    if (pb) {
      new MutationObserver(scheduleRender)
          .observe(pb, {attributes: true, attributeFilter: ['class']});
    }
    // Keep the read-only view live with the same comment-mutation events the
    // editor client listens to, so an open history view never goes stale.
    socket.on('pushAddComment', (commentId, comment) => { comments[commentId] = comment; scheduleRender(); });
    socket.on('commentDeleted', (commentId) => { delete comments[commentId]; scheduleRender(); });
    socket.on('textCommentUpdated', (commentId, commentText) => {
      if (comments[commentId]) { comments[commentId].text = commentText; scheduleRender(); }
    });
    socket.on('changeAccepted', (commentId) => {
      if (comments[commentId]) { comments[commentId].changeAccepted = true; scheduleRender(); }
    });
    socket.on('changeReverted', (commentId) => {
      if (comments[commentId]) { comments[commentId].changeAccepted = false; scheduleRender(); }
    });
  } catch (_e) {
    // The timeslider must never break because of comments — fail silent.
  }
};
