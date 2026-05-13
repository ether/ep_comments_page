import {Frame, Locator, Page, expect} from '@playwright/test';
import {getPadBody, getPadOuter, goToNewPad, goToPad}
    from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';

// Reproduces the legacy `utils.aNewPad`: open a new pad, then wait for
// ep_comments_page's postAceInit to finish (initDone is a Promise that
// resolves once plugin init is complete).
export const aNewCommentsPad = async (page: Page): Promise<string> => {
  const padId = await goToNewPad(page);
  await waitForCommentsInit(page);
  return padId;
};

export const reopenCommentsPad = async (page: Page, padId: string): Promise<void> => {
  await goToPad(page, padId);
  await waitForCommentsInit(page);
};

// Reopen the same pad as a fresh user so a new authorId is allocated. Used
// by the delete/edit "other user" specs which assert that one user cannot
// modify another user's comment. Plain reopenCommentsPad reuses the same
// session cookies (token / express_sid), so Etherpad keeps the original
// authorId and the auth-check on delete/edit short-circuits to success.
export const reopenCommentsPadAsFreshUser = async (
  page: Page, padId: string,
): Promise<void> => {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try { window.localStorage.clear(); } catch {}
    try { window.sessionStorage.clear(); } catch {}
  }).catch(() => {});
  await goToPad(page, padId);
  await waitForCommentsInit(page);
};

export const waitForCommentsInit = async (page: Page): Promise<void> => {
  await expect.poll(async () => page.evaluate(async () => {
    const w = window as any;
    const ep = w.pad && w.pad.plugins && w.pad.plugins.ep_comments_page;
    if (!ep || !ep.initDone) return false;
    await ep.initDone;
    return true;
  }), {timeout: 60_000}).toBe(true);
};

// Returns the inner pad body (Locator).
export const inner = async (page: Page): Promise<Locator> => getPadBody(page);

// Returns the outer iframe Frame (where #commentIcons / sidebar comments live).
export const outer = async (page: Page): Promise<Frame> => getPadOuter(page);

export const enlargeScreen = async (page: Page, maxWidth = '3000px'): Promise<void> => {
  await page.evaluate((mw) => {
    const ifr = document.querySelector<HTMLIFrameElement>('#iframe-container iframe');
    if (ifr) ifr.style.maxWidth = mw;
  }, maxWidth);
};

export const restoreScreen = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const ifr = document.querySelector<HTMLIFrameElement>('#iframe-container iframe');
    if (ifr) ifr.style.maxWidth = '';
  });
};

// Replace pad content with provided lines (joined with \n). Mirrors the
// legacy cleanPad + sendkeys pattern.
export const setPadLines = async (page: Page, lines: string[]): Promise<void> => {
  const body = await getPadBody(page);
  await body.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  // Wait for first line to be empty.
  await expect.poll(async () => body.locator('div').count()).toBeGreaterThan(0);
  for (let i = 0; i < lines.length; i++) {
    await page.keyboard.type(lines[i]);
    if (i < lines.length - 1) await page.keyboard.press('Enter');
  }
  await expect.poll(async () => body.locator('div').count())
      .toBeGreaterThanOrEqual(lines.length);
};

// Select all text on a given line index (0-based). Implemented by triple-click
// on the corresponding div, which selects the line content.
export const selectLine = async (page: Page, lineIndex: number): Promise<void> => {
  const body = await getPadBody(page);
  const line = body.locator('div').nth(lineIndex);
  await line.click();
  // Triple-click to select the entire line content.
  await line.click({clickCount: 3});
};

// Clicks the toolbar Add Comment button (lives in the chrome page).
// Waits for the button to be enabled (i.e., text is currently selected in the editor).
export const clickAddCommentButton = async (page: Page): Promise<void> => {
  await expect.poll(async () =>
    !(await page.locator('.addComment').first().evaluate(
      (el: Element) => el.classList.contains('disabled')
    ))
  ).toBe(true);
  await page.locator('.addComment').first().click();
};

export const fillCommentForm = async (
  page: Page,
  commentText: string,
  suggestion?: string,
): Promise<void> => {
  const field = page.locator('textarea.comment-content');
  await field.fill(commentText);
  if (suggestion !== undefined) {
    // Click the label (not the input): the adjacent <label> intercepts pointer
    // events on the small native checkbox in some browsers, so click the label
    // — which is also how a user toggles the checkbox in the UI.
    await page.locator('#newComment .label-suggestion-checkbox').first().click();
    await page.locator('textarea.to-value').fill(suggestion);
  }
};

export const submitNewCommentForm = async (page: Page): Promise<void> => {
  await page.locator('.comment-buttons input[type=submit]').first().click();
};

export const getCommentIdOfLine = async (
  page: Page, lineIndex: number,
): Promise<string | null> => {
  const body = await getPadBody(page);
  const cls = await body.locator('div').nth(lineIndex).locator('.comment').first()
      .getAttribute('class').catch(() => null);
  if (!cls) return null;
  const m = /(?:^| )(c-[A-Za-z0-9]*)/.exec(cls);
  return m ? m[1] : null;
};

export const waitForCommentOnLine = async (page: Page, lineIndex: number): Promise<string> => {
  await expect.poll(async () => (await getCommentIdOfLine(page, lineIndex)) != null,
      {timeout: 30_000}).toBe(true);
  return (await getCommentIdOfLine(page, lineIndex))!;
};

export const commentIconsEnabled = async (page: Page): Promise<boolean> => {
  const o = await getPadOuter(page);
  return (await o.locator('#commentIcons').count()) > 0;
};

export const displayCommentAsIcon = async (page: Page): Promise<boolean> => {
  return await page.evaluate(() => Boolean((window as any).clientVars?.displayCommentAsIcon));
};

export const highlightSelectedTextEnabled = async (page: Page): Promise<boolean> => {
  return await page.evaluate(() => Boolean((window as any).clientVars?.highlightSelectedText));
};

// Add a comment to the given line, optionally with a suggested change.
// Returns the new comment id.
export const addCommentToLine = async (
  page: Page,
  lineIndex: number,
  text: string,
  suggestion?: string,
): Promise<string> => {
  await selectLine(page, lineIndex);
  await clickAddCommentButton(page);
  await fillCommentForm(page, text, suggestion);
  await submitNewCommentForm(page);
  return await waitForCommentOnLine(page, lineIndex);
};

export const addReplyToLine = async (
  page: Page,
  lineIndex: number,
  replyText: string,
  withSuggestion = false,
  suggestionText?: string,
): Promise<void> => {
  const o = await getPadOuter(page);
  const commentId = await getCommentIdOfLine(page, lineIndex);
  const existing = await o.locator('.sidebar-comment-reply').count();

  if (await commentIconsEnabled(page)) {
    await o.locator(`#commentIcons #icon-${commentId}`).first().click();
  } else {
    // Reply form is inside .full-display-content which is display:none on
    // the sidebar comment until it gets the .full-display class. Hover the
    // sidebar comment to trigger commentBoxes.highlightComment, which sets
    // it; otherwise locator.fill() times out on a hidden input.
    await o.locator(`#${commentId}`).first().hover();
    await expect.poll(async () =>
      o.locator(`#${commentId}.full-display`).count()).toBeGreaterThan(0);
  }

  // Scope to the reply form's input — the new-comment popup may also
  // have a `.comment-content` element open at this point.
  const replyForm = o.locator(`#${commentId} form.new-comment`).first();
  await replyForm.locator('.comment-content').fill(replyText);
  if (withSuggestion) {
    await replyForm.locator('.label-suggestion-checkbox').first().click();
    if (suggestionText !== undefined) {
      await replyForm.locator('textarea.to-value').first().fill(suggestionText);
    }
  }
  await replyForm.locator("input[type='submit']").first().click();
  await expect.poll(async () => o.locator('.sidebar-comment-reply').count())
      .toBe(existing + 1);
};

// Expand a sidebar comment so its .full-display-content (containing
// .comment-edit / .comment-delete / reply form) is visible. The plugin
// only adds .full-display on mouseover, so any test that touches those
// children after a fresh page load needs to call this first.
export const expandSidebarComment = async (
  page: Page,
  commentId: string,
): Promise<void> => {
  const o = await getPadOuter(page);
  await expect.poll(async () => o.locator(`#${commentId}`).count()).toBeGreaterThan(0);
  await o.locator(`#${commentId}`).first().hover();
  await expect.poll(async () =>
    o.locator(`#${commentId}.full-display`).count()).toBeGreaterThan(0);
};

// Open Etherpad settings, toggle Show Comments to desired state, close settings.
export const chooseToShowComments = async (
  page: Page, shouldShow: boolean,
): Promise<void> => {
  const settings = page.locator('.buttonicon-settings');
  await settings.click();
  const showComments = page.locator('#options-comments');
  const checked = await showComments.isChecked();
  if (checked !== shouldShow) await showComments.click();
  await settings.click();
};

// Change Etherpad UI language. niceSelect.js wraps the language <select>
// with a sibling .nice-select div and intercepts native change events,
// so plain selectOption() won't actually flip the locale. Drive the
// niceSelect dropdown the same way etherpad core's language.spec does.
export const changeLanguageTo = async (page: Page, lang: string): Promise<void> => {
  const settings = page.locator('.buttonicon-settings');
  await settings.click();
  const dropdown = page.locator('#languagemenu + .nice-select');
  await dropdown.click();
  await page.locator('.nice-select.open').locator(`[data-value=${lang}]`).click();
  await settings.click();
};
