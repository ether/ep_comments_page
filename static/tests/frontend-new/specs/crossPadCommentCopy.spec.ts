import {expect, test} from '@playwright/test';
import {getPadBody} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad, clickAddCommentButton, waitForCommentsInit} from '../helper/comments';

// #79: copying commented text from one pad and pasting it into another should
// carry the whole comment, not just yellow-highlighted text. The copy handler
// puts the comment data on the clipboard and the paste handler recreates the
// comments in the destination pad (assigning fresh ids). This guards that the
// comment — with its text — survives a cross-pad copy/paste.
test.describe('ep_comments_page - Cross-pad comment copy (#79)', () => {
  test('pasting commented text into another pad brings the comment', async ({page, context}) => {
    test.setTimeout(60_000);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    // Pad A: write text and comment it.
    await aNewCommentsPad(page);
    let inner = await getPadBody(page);
    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('text copied between pads');
    await expect.poll(async () => {
      await inner.locator('div').first().click({clickCount: 3});
      await clickAddCommentButton(page); // disambiguated (.first()) helper
      return page.locator('#newComment.popup-show').count();
    }, {timeout: 20_000}).toBeGreaterThan(0);
    await page.locator('#newComment textarea.comment-content').fill('CROSS_PAD_COMMENT');
    await page.locator('#comment-create-btn').click();
    await expect.poll(async () => inner.locator('.comment').count()).toBeGreaterThan(0);

    // Copy the commented text, then wait until the clipboard actually holds it
    // (deterministic, instead of a fixed sleep).
    await inner.locator('div').first().locator('.comment').first().click({clickCount: 3});
    await page.keyboard.press('Control+C');
    await expect.poll(async () =>
      page.evaluate(() => navigator.clipboard.readText().catch(() => '')),
    {timeout: 10_000}).toContain('text copied between pads');

    // Pad B: a different pad in the same browser context.
    const base = page.url().split('/p/')[0];
    await page.goto(`${base}/p/cross_pad_dest_${Date.now()}`);
    await waitForCommentsInit(page); // shared 60s init wait (no duplicated logic)

    inner = await getPadBody(page);
    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.press('Control+V');

    // The comment is recreated in pad B with its original text, and the inline
    // highlight is present (not just plain/yellow text with no comment).
    await expect.poll(async () => page.evaluate(async () => {
      const ep = (window as any).pad.plugins.ep_comments_page;
      const r = await ep.getComments();
      const c = (r && r.comments ? r.comments : r) || {};
      return Object.values(c).map((x: any) => x.text);
    }), {timeout: 15_000}).toContain('CROSS_PAD_COMMENT');
    await expect.poll(async () => inner.locator('.comment').count()).toBeGreaterThan(0);
  });
});
