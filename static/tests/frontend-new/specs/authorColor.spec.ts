import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #6: each comment box should carry its author's colour. We render it as a
// left-border accent (contrast-safe). For the author's own comment the colour
// is clientVars.userColor; other authors resolve from historicalAuthorData.
test.describe('ep_comments_page - Author colour accent (#6)', () => {
  test('comment box border uses the author colour', async ({page}) => {
    test.setTimeout(60_000);
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    const outer = await getPadOuter(page);

    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('text to be commented by me');
    await expect.poll(async () => {
      await inner.locator('div').first().click({clickCount: 3});
      await page.locator('.addComment').click();
      return page.locator('#newComment.popup-show').count();
    }, {timeout: 20_000}).toBeGreaterThan(0);
    await page.locator('#newComment textarea.comment-content').fill('my comment');
    await page.locator('#comment-create-btn').click();

    const box = outer.locator('#comments .sidebar-comment').first();
    await expect.poll(async () => box.count()).toBeGreaterThan(0);

    // clientVars lives on the main pad window, not the ace_outer frame where
    // the box is, so read the user colour from the page and pass it in. It may
    // be a palette index, so resolve it to a hex like the plugin does.
    const userColor: string = await page.evaluate(() => {
      const cv = (window as any).clientVars;
      let c = cv.userColor;
      if (typeof c === 'number') c = cv.colorPalette[c];
      return c;
    });
    expect(userColor).toBeTruthy();

    // The box's left-border colour must equal the current user's colour
    // (normalise both through the browser so hex vs rgb() doesn't matter).
    const result = await box.evaluate((el, uc) => {
      const norm = (c: string) => {
        const probe = document.createElement('span');
        probe.style.color = c;
        document.body.appendChild(probe);
        const rgb = getComputedStyle(probe).color;
        probe.remove();
        return rgb;
      };
      return {borderColor: getComputedStyle(el).borderLeftColor, expected: norm(uc)};
    }, userColor);
    expect(result.borderColor).toBe(result.expected);
    // And it must not be the default transparent placeholder.
    expect(result.borderColor).not.toBe('rgba(0, 0, 0, 0)');
  });
});
