import {expect, test} from '@playwright/test';
import {getPadBody} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #68: read-only users can comment. The plugin's handleMessageSecurity hook
// deliberately permits a read-only session to make changes that only touch the
// `comment` attribute, so a viewer can annotate a read-only pad even though they
// can't edit its text. This guards that end-to-end behaviour.
test.describe('ep_comments_page - Commenting on a read-only pad (#68)', () => {
  test('a read-only viewer can add a comment that persists', async ({page}) => {
    test.setTimeout(60_000);

    // Author a writable pad with some text.
    await aNewCommentsPad(page);
    let inner = await getPadBody(page);
    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('text that a read-only viewer will comment on');
    await page.waitForTimeout(1000);

    // Open the pad via its read-only id.
    const readOnlyId: string = await page.evaluate(() => (window as any).clientVars.readOnlyId);
    expect(readOnlyId).toMatch(/^r\./);
    const base = page.url().split('/p/')[0];
    await page.goto(`${base}/p/${readOnlyId}`);
    await expect.poll(async () => page.evaluate(async () => {
      const ep = (window as any).pad?.plugins?.ep_comments_page;
      if (!ep || !ep.initDone) return false;
      await ep.initDone;
      return (window as any).clientVars.readonly === true;
    }), {timeout: 30_000}).toBe(true);

    inner = await getPadBody(page);
    // Select the text and add a comment from the read-only view.
    await expect.poll(async () => {
      await inner.locator('div').first().click({clickCount: 3});
      await page.locator('.addComment').click();
      return page.locator('#newComment.popup-show').count();
    }, {timeout: 20_000}).toBeGreaterThan(0);
    await page.locator('#newComment textarea.comment-content').fill('a read-only viewer comment');
    await page.locator('#comment-create-btn').click();

    // The inline highlight appears and the comment is stored server-side.
    await expect.poll(async () =>
      inner.locator('.comment').count()).toBeGreaterThan(0);
    await expect.poll(async () => page.evaluate(async () => {
      const ep = (window as any).pad.plugins.ep_comments_page;
      const r = await ep.getComments();
      const c = r && r.comments ? r.comments : r;
      return Object.keys(c || {}).length;
    })).toBeGreaterThan(0);

    // It persists: reload the read-only pad and the highlight is still there.
    await page.reload();
    await expect.poll(async () => page.evaluate(async () => {
      const ep = (window as any).pad?.plugins?.ep_comments_page;
      if (!ep || !ep.initDone) return false;
      await ep.initDone;
      return true;
    }), {timeout: 30_000}).toBe(true);
    const innerAfter = await getPadBody(page);
    await expect.poll(async () => innerAfter.locator('.comment').count()).toBeGreaterThan(0);
  });
});
