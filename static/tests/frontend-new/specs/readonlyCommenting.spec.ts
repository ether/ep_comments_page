import {expect, test} from '@playwright/test';
import {getPadBody} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #8: read-only viewers must NOT be able to comment by default. The capability
// is gated behind the `allowReadonlyComments` setting (default false): with it
// off, the add-comment button is hidden on a read-only pad and the server
// rejects comment-attribute changes from a read-only session. (When an admin
// turns it on, the plugin's handleMessageSecurity hook permits comment-only
// changes — exercised separately, as it needs a settings.json change.)
test.describe('ep_comments_page - Read-only commenting is off by default (#8)', () => {
  test('the add-comment button is hidden on a read-only pad', async ({page}) => {
    test.setTimeout(60_000);

    // Author a writable pad, then open it read-only.
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('a read-only viewer should not be able to comment here');
    await page.waitForTimeout(800);

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

    // With the feature off (default), the add-comment affordance is not shown.
    expect(await page.evaluate(() => (window as any).clientVars.allowReadonlyComments))
        .toBeFalsy();
    await expect.poll(async () => page.locator('.addComment:visible').count()).toBe(0);
  });
});
