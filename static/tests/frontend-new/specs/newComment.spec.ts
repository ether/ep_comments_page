import {expect, test} from '@playwright/test';
import {getPadBody} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad, clickAddCommentButton} from '../helper/comments';

test.describe('ep_comments_page - New comment', () => {
  test('new comment button focuses on comment textarea', async ({page}) => {
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('commented text');
    await inner.locator('div').first().click({clickCount: 3});

    await page.locator('.addComment').click();

    // The textarea must be the active element in the chrome document.
    const isFocused = await page.evaluate(() => {
      const ta = document.querySelector<HTMLTextAreaElement>(
          '#newComment .comment-content');
      return !!ta && document.activeElement === ta;
    });
    expect(isFocused).toBe(true);
  });
});

test.describe('ep_comments_page - Add Comment button disabled state', () => {
  test.beforeEach(async ({page}) => {
    // aNewCommentsPad waits for the plugin to initialise, which can take up to 60s.
    test.setTimeout(60_000);
  });

  test('button is disabled on load (no text selected)', async ({page}) => {
    await aNewCommentsPad(page);
    await expect.poll(async () =>
      page.locator('.addComment').first().evaluate(
        (el: Element) => el.classList.contains('disabled')
      )
    ).toBe(true);
    const ariaDisabled = await page.locator('.addComment a').first().getAttribute('aria-disabled');
    expect(ariaDisabled).toBe('true');
  });

  test('button is enabled when text is selected', async ({page}) => {
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    await inner.click();
    await page.keyboard.type('some text');
    await inner.locator('div').first().click({clickCount: 3});
    // Button should become enabled after selection.
    await expect.poll(async () =>
      page.locator('.addComment').first().evaluate(
        (el: Element) => el.classList.contains('disabled')
      )
    ).toBe(false);
    const ariaDisabled = await page.locator('.addComment a').first().getAttribute('aria-disabled');
    expect(ariaDisabled).toBeNull();
  });

  test('button becomes disabled again after selection is cleared', async ({page}) => {
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    await inner.click();
    await page.keyboard.type('some text');
    // Select text.
    await inner.locator('div').first().click({clickCount: 3});
    await expect.poll(async () =>
      page.locator('.addComment').first().evaluate(
        (el: Element) => !el.classList.contains('disabled')
      )
    ).toBe(true);
    // Click elsewhere to deselect.
    await inner.click();
    // Button should become disabled again.
    await expect.poll(async () =>
      page.locator('.addComment').first().evaluate(
        (el: Element) => el.classList.contains('disabled')
      )
    ).toBe(true);
  });

  test('clicking disabled button does not open the comment form', async ({page}) => {
    await aNewCommentsPad(page);
    // Ensure no text is selected (button is disabled).
    await expect.poll(async () =>
      page.locator('.addComment').first().evaluate(
        (el: Element) => el.classList.contains('disabled')
      )
    ).toBe(true);
    // Click the <li> directly (bypassing pointer-events: none on the <a>).
    await page.locator('.addComment').first().click();
    // The comment form must not appear.
    await expect(page.locator('#newComment.popup-show')).toHaveCount(0);
  });

  test('clicking enabled button opens the comment form', async ({page}) => {
    await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    await inner.click();
    await page.keyboard.type('some text');
    await inner.locator('div').first().click({clickCount: 3});
    await clickAddCommentButton(page);
    await expect(page.locator('#newComment.popup-show')).toHaveCount(1);
  });
});
