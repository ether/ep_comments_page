import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #112: on a read-only pad the edit/delete comment controls should not be
// shown — the server already rejects those writes, so the buttons are dead.
// The comment sidebar lives in the ace_outer iframe, which doesn't get core's
// `readonly` body class, so the plugin tags it `comments-readonly` and the CSS
// hides .comment-actions-wrapper there.
test.describe('ep_comments_page - Read-only hides comment actions (#112)', () => {
  test('edit/delete actions are hidden on the read-only pad but shown on r/w',
      async ({page}) => {
        test.setTimeout(60_000);
        await aNewCommentsPad(page);
        const inner = await getPadBody(page);
        const outer = await getPadOuter(page);

        // Create a comment on typed text.
        await inner.click();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Delete');
        await page.keyboard.type('text that will be commented');
        // Retry the selection + trigger until the form shows (the triple-click
        // selection can race the toolbar on a freshly loaded pad).
        await expect.poll(async () => {
          await inner.locator('div').first().click({clickCount: 3});
          await page.locator('.addComment').click();
          return page.locator('#newComment.popup-show').count();
        }, {timeout: 20_000}).toBeGreaterThan(0);
        await page.locator('#newComment textarea.comment-content').fill('a comment');
        await page.locator('#comment-create-btn').click();
        await expect.poll(async () =>
          inner.locator('div').first().locator('.comment').count()).toBeGreaterThan(0);

        // Sanity: on the writable pad the actions wrapper exists and is visible.
        await expect.poll(async () =>
          outer.locator('#comments .comment-actions-wrapper').count()).toBeGreaterThan(0);
        expect(await outer.locator('#comments .comment-actions-wrapper').first()
            .evaluate((el) => window.getComputedStyle(el).display)).not.toBe('none');

        // Wait for the comment to persist, then open the read-only view.
        const readOnlyId: string = await page.evaluate(async () => {
          const w = window as any;
          // Ensure the comment is stored before we switch pads.
          await w.pad.plugins.ep_comments_page.getComments();
          return w.clientVars.readOnlyId;
        });
        expect(readOnlyId).toMatch(/^r\./);
        const base = page.url().split('/p/')[0];
        await page.goto(`${base}/p/${readOnlyId}`);

        // The plugin still initialises and shows comments on the read-only pad.
        await expect.poll(async () => page.evaluate(async () => {
          const ep = (window as any).pad?.plugins?.ep_comments_page;
          if (!ep || !ep.initDone) return false;
          await ep.initDone;
          return true;
        }), {timeout: 30_000}).toBe(true);

        const roOuter = await getPadOuter(page);
        await expect.poll(async () =>
          roOuter.locator('#comments .sidebar-comment').count()).toBeGreaterThan(0);

        // The actions wrapper is present in the DOM but hidden by the CSS.
        await expect.poll(async () =>
          roOuter.locator('#comments .comment-actions-wrapper').count()).toBeGreaterThan(0);
        const display = await roOuter.locator('#comments .comment-actions-wrapper').first()
            .evaluate((el) => window.getComputedStyle(el).display);
        expect(display).toBe('none');
        // And the outer body carries the marker class.
        expect(await roOuter.locator('#outerdocbody.comments-readonly').count())
            .toBeGreaterThan(0);
      });
});
