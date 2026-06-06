import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #12/#5: a "Show all comments" checkbox in the Settings pane toggles a panel
// that lists every comment in the pad and lets you jump to one. The existing
// sidebar is Y-aligned to the text; this is a flat, browsable index.
const setOverview = async (page: import('@playwright/test').Page, on: boolean) =>
  page.evaluate((checked) => {
    const cb = document.querySelector('#options-comments-overview') as HTMLInputElement;
    cb.checked = checked;
    cb.dispatchEvent(new Event('change', {bubbles: true}));
  }, on);

test.describe('ep_comments_page - All-comments overview (#12)', () => {
  test('lists every comment and jumps to one', async ({page}) => {
    test.setTimeout(60_000);
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    const outer = await getPadOuter(page);

    const addCommentOnLine = async (lineIndex: number, text: string) => {
      await expect.poll(async () => {
        await inner.locator('div').nth(lineIndex).click({clickCount: 3});
        await page.locator('.addComment').click();
        return page.locator('#newComment.popup-show').count();
      }, {timeout: 20_000}).toBeGreaterThan(0);
      await page.locator('#newComment textarea.comment-content').fill(text);
      await page.locator('#comment-create-btn').click();
      await expect(page.locator('#newComment.popup-show')).toBeHidden();
    };

    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('first commented line');
    await page.keyboard.press('Enter');
    await page.keyboard.type('second commented line');

    await addCommentOnLine(0, 'COMMENT_ONE_MARKER');
    await addCommentOnLine(1, 'COMMENT_TWO_MARKER');

    // Open the overview from the Settings "Show all comments" checkbox.
    const panel = page.locator('#comments-overview');
    await setOverview(page, true);
    await expect(panel).toHaveClass(/visible/);

    // It lists both comments.
    const rows = panel.locator('.comments-overview-row');
    await expect.poll(async () => rows.count()).toBe(2);
    await expect(panel).toContainText('COMMENT_ONE_MARKER');
    await expect(panel).toContainText('COMMENT_TWO_MARKER');

    // Clicking a row opens that comment's box in the sidebar.
    await rows.first().click();
    await expect.poll(async () =>
      outer.locator('#comments .sidebar-comment.full-display').count()).toBeGreaterThan(0);

    // Un-ticking the setting hides the panel again.
    await setOverview(page, false);
    await expect(panel).not.toHaveClass(/visible/);
  });
});
