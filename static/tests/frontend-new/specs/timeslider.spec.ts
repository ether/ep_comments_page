import {Page, expect, test} from '@playwright/test';
import {getPadOuter} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {
  addCommentToLine,
  aNewCommentsPad,
  chooseToShowComments,
  enlargeScreen,
  expandSidebarComment,
  setPadLines,
} from '../helper/comments';

// Read-only comments in the timeslider / in-place history (ep_comments_page#33).
// The standalone embed timeslider and the in-place history iframe are the same
// `?embed=1` page, so the embed URL exercises the same code path the in-place
// history mounts; the toggle test uses real in-place history because the
// "Show Comments" control only exists on the outer pad.

const embedTimeslider = (padId: string) =>
  `http://localhost:9001/p/${padId}/timeslider?embed=1`;

const openEmbedTimeslider = async (page: Page, padId: string) => {
  await page.goto(embedTimeslider(padId));
  await page.locator('#innerdocbody').waitFor({timeout: 30_000});
};

const collabRev = (page: Page) =>
  page.evaluate(() => (window as any).pad.getCollabRevisionNumber() as number);

// Add a comment, then wait until the collab revision has advanced past where it
// was AND stopped moving (all changesets accepted by the server). The timeslider
// loads the server's committed head, and tests navigate the editor page to get
// there — so the comment must be fully committed first, otherwise it is lost on
// navigation / absent from the loaded revision.
const addCommentAndCommit = async (
  page: Page, lineIndex: number, text: string, suggestion?: string,
): Promise<string> => {
  const revBefore = await collabRev(page);
  const commentId = await addCommentToLine(page, lineIndex, text, suggestion);
  let lastRev = -1;
  let stableTicks = 0;
  await expect.poll(async () => {
    const rev = await collabRev(page);
    stableTicks = (rev > revBefore && rev === lastRev) ? stableTicks + 1 : 0;
    lastRev = rev;
    return stableTicks;
  }, {timeout: 20_000, intervals: [400]}).toBeGreaterThanOrEqual(3);
  return commentId;
};

test.describe('ep_comments_page - timeslider read-only comments', () => {
  test('comments render read-only and aligned to their text (#33)', async ({page}) => {
    const padId = await aNewCommentsPad(page);
    await setPadLines(page, ['First line', 'Second line', 'Third line']);
    await addCommentAndCommit(page, 1, 'Comment on the second line');

    await openEmbedTimeslider(page, padId);

    const box = page.locator('#comments .sidebar-comment').first();
    await expect(box).toBeVisible({timeout: 30_000});
    await expect(page.locator('#comments .comment-text').first())
        .toContainText('Comment on the second line');

    // Read-only: no edit/delete/reply/accept controls are ever created.
    await expect(page.locator(
        '#comments .comment-edit, #comments .comment-delete, #comments textarea, ' +
        '#comments .approve-suggestion-btn, #comments .revert-suggestion-btn'))
        .toHaveCount(0);

    // The box lines up with the text it annotates.
    const aligned = await page.evaluate(() => {
      const b = document.querySelector('#comments .sidebar-comment') as HTMLElement | null;
      const span = b && document.querySelector(`#innerdocbody .${b.id}`);
      if (!b || !span) return false;
      return Math.abs(b.getBoundingClientRect().top - span.getBoundingClientRect().top) < 4;
    });
    expect(aligned).toBe(true);
  });

  test('comments appear and disappear as the revision changes', async ({page}) => {
    const padId = await aNewCommentsPad(page);
    await setPadLines(page, ['The only line']);
    await addCommentAndCommit(page, 0, 'A note');

    await openEmbedTimeslider(page, padId);
    await expect(page.locator('#comments .sidebar-comment')).toHaveCount(1, {timeout: 30_000});

    // Load the empty first revision (#0). The timeslider reads the revision from
    // the URL on load (works on every core, unlike runtime window.BroadcastSlider
    // which only exists on develop). A bare goto to a hash-only-different URL is
    // a same-document nav and won't re-init, so force a reload.
    await page.goto(`${embedTimeslider(padId)}#0`);
    await page.reload();
    await page.locator('#innerdocbody').waitFor({timeout: 30_000});
    await expect(page.locator('#comments .sidebar-comment')).toHaveCount(0);

    // Back to the latest revision -> the comment returns.
    await page.goto(embedTimeslider(padId));
    await page.reload();
    await page.locator('#innerdocbody').waitFor({timeout: 30_000});
    await expect(page.locator('#comments .sidebar-comment')).toHaveCount(1, {timeout: 30_000});
  });

  test('a suggested change shows from -> to, struck through when accepted', async ({page}) => {
    const padId = await aNewCommentsPad(page);
    await setPadLines(page, ['Teh quick fox']);
    await addCommentAndCommit(page, 0, 'typo', 'The quick fox');

    await openEmbedTimeslider(page, padId);
    const box = page.locator('#comments .sidebar-comment').first();
    await expect(box).toBeVisible({timeout: 30_000});
    await box.click(); // expand to the full read-only view

    await expect(page.locator('#comments .suggestion-display .to-value').first())
        .toContainText('The quick fox');
    // Pending suggestion: the old text is not struck.
    await expect(page.locator('#comments .from-value').first())
        .toHaveCSS('text-decoration-line', 'none');
    // Accepted suggestion: the old ("from") text is struck through.
    const struck = await page.evaluate(() => {
      const b = document.querySelector('#comments .sidebar-comment')!;
      b.classList.add('change-accepted');
      return getComputedStyle(b.querySelector('.from-value')!).textDecorationLine;
    });
    expect(struck).toBe('line-through');
  });

  test('hovering relates a comment and its text both ways', async ({page}) => {
    const padId = await aNewCommentsPad(page);
    await setPadLines(page, ['Hover this line']);
    await addCommentAndCommit(page, 0, 'Hover comment');

    await openEmbedTimeslider(page, padId);
    const box = page.locator('#comments .sidebar-comment').first();
    await expect(box).toBeVisible({timeout: 30_000});
    const id = (await box.getAttribute('id'))!;

    // Hover the box -> its inline text highlights, and clears on leave.
    await box.hover();
    await expect(page.locator(`#innerdocbody .${id}.ts-related`)).toHaveCount(1);
    await page.mouse.move(2, 2);
    await expect(page.locator(`#innerdocbody .${id}.ts-related`)).toHaveCount(0);

    // Hover the inline text -> its box highlights.
    await page.locator(`#innerdocbody .${id}`).first().hover();
    await expect.poll(() => page.evaluate((i) =>
      document.getElementById(i)?.classList.contains('ts-related'), id)).toBe(true);
  });

  test('Show Comments off hides the sidebar and the inline highlight in history', async ({page}) => {
    const padId = await aNewCommentsPad(page);
    await setPadLines(page, ['A commented passage']);
    await addCommentAndCommit(page, 0, 'note');

    // In-place history (#7659) is develop-only; the toggle lives on the outer
    // pad and drives the mounted history iframe. Skip on cores without it.
    await page.goto(`http://localhost:9001/p/${padId}#rev/latest`);
    const inPlaceHistory = await page.locator('#history-frame')
        .waitFor({timeout: 10_000}).then(() => true).catch(() => false);
    test.skip(!inPlaceHistory, 'requires in-place history mode (Etherpad develop / 2.8+)');
    const frame = page.frameLocator('#history-frame');
    await expect(frame.locator('#comments .sidebar-comment')).toHaveCount(1, {timeout: 30_000});

    // Toggle off -> sidebar gone AND the inline highlight cleared.
    await chooseToShowComments(page, false);
    await expect(frame.locator('#comments .sidebar-comment')).toHaveCount(0);
    const bgOff = await frame.locator('#innerdocbody .comment').first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(bgOff);

    // Toggle back on -> both return.
    await chooseToShowComments(page, true);
    await expect(frame.locator('#comments .sidebar-comment')).toHaveCount(1);
  });

  test('an open history view reflects a live comment edit without reload', async ({page, context}) => {
    test.setTimeout(60_000);
    const padId = await aNewCommentsPad(page);
    await setPadLines(page, ['An editable line']);
    const commentId = await addCommentAndCommit(page, 0, 'original text');
    await enlargeScreen(page); // widen the editor so the edit controls are reachable

    // Open the timeslider in a second tab; its socket joins the same room.
    const ts = await context.newPage();
    await ts.goto(embedTimeslider(padId));
    await ts.locator('#innerdocbody').waitFor({timeout: 30_000});
    await expect(ts.locator('#comments .comment-text').first())
        .toContainText('original text', {timeout: 30_000});

    // Edit the comment in the editor.
    const outer = await getPadOuter(page);
    await expandSidebarComment(page, commentId);
    await outer.locator('.comment-edit').first().click();
    await outer.locator('.comment-edit-form .comment-edit-text').first()
        .evaluate((el, t) => { (el as HTMLElement).innerText = t; }, 'edited text');
    await outer.locator('.comment-edit-form .comment-edit-submit').first().click();

    // The already-open history view updates live via the textCommentUpdated event.
    await expect(ts.locator('#comments .comment-text').first())
        .toContainText('edited text', {timeout: 15_000});
  });
});
