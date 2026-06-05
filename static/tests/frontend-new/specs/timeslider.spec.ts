import {Page, expect, test} from '@playwright/test';
import {addCommentToLine, aNewCommentsPad, chooseToShowComments, setPadLines} from '../helper/comments';

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

test.describe('ep_comments_page - timeslider read-only comments', () => {
  test('comments render read-only and aligned to their text (#33)', async ({page}) => {
    const padId = await aNewCommentsPad(page);
    await setPadLines(page, ['First line', 'Second line', 'Third line']);
    await addCommentToLine(page, 1, 'Comment on the second line');

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
    await addCommentToLine(page, 0, 'A note');

    await openEmbedTimeslider(page, padId);
    await expect(page.locator('#comments .sidebar-comment')).toHaveCount(1, {timeout: 30_000});

    // Scrub to the very first revision (before the commented text existed).
    await expect.poll(() => page.evaluate(() =>
      typeof (window as any).BroadcastSlider?.setSliderPosition === 'function')).toBe(true);
    await page.evaluate(() => (window as any).BroadcastSlider.setSliderPosition(0));
    await expect(page.locator('#comments .sidebar-comment')).toHaveCount(0);

    // Back to the latest revision -> the comment returns.
    await page.evaluate(() => {
      const bs = (window as any).BroadcastSlider;
      bs.setSliderPosition(bs.getSliderLength());
    });
    await expect(page.locator('#comments .sidebar-comment')).toHaveCount(1);
  });

  test('a suggested change shows from -> to, struck through when accepted', async ({page}) => {
    const padId = await aNewCommentsPad(page);
    await setPadLines(page, ['Teh quick fox']);
    await addCommentToLine(page, 0, 'typo', 'The quick fox');

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
    await addCommentToLine(page, 0, 'Hover comment');

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
    await addCommentToLine(page, 0, 'note');

    // In-place history: the "Show Comments" toggle lives on the outer pad.
    await page.goto(`http://localhost:9001/p/${padId}#rev/latest`);
    await page.locator('#history-frame').waitFor({timeout: 30_000});
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
});
