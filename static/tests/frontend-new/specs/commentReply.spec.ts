import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter}
    from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {
  aNewCommentsPad,
  chooseToShowComments,
  commentIconsEnabled,
  enlargeScreen,
  getCommentIdOfLine,
  setPadLines,
  waitForCommentOnLine,
} from '../helper/comments';

const createReply = async (page: import('@playwright/test').Page, withSuggestion: boolean) => {
  const outer = await getPadOuter(page);
  const commentId = await getCommentIdOfLine(page, 0);
  const existing = await outer.locator('.sidebar-comment-reply').count();
  if (await commentIconsEnabled(page)) {
    await outer.locator(`#commentIcons #icon-${commentId}`).first().click();
  }
  await outer.locator('.comment-content').first().fill('My reply');
  if (withSuggestion) {
    await outer.locator('.suggestion-checkbox').first().click();
    await outer.locator('textarea.to-value').first().fill('My suggestion');
  }
  await outer.locator("form.new-comment input[type='submit']").first().click();
  await expect.poll(async () => outer.locator('.sidebar-comment-reply').count())
      .toBe(existing + 1);
};

// Faithful 1:1 port — all original tests were xit (skipped) in the legacy spec.
test.describe('ep_comments_page - Comment Reply', () => {
  test.beforeEach(async ({page}) => {
    test.setTimeout(60_000);
    await aNewCommentsPad(page);
    await chooseToShowComments(page, true);
    await setPadLines(page, ['This content will receive a comment']);
    const inner = await getPadBody(page);
    await inner.locator('div').first().click({clickCount: 3});
    await page.locator('.addComment').first().click();
    await page.locator('textarea.comment-content').fill('My comment');
    const outer = await getPadOuter(page);
    await outer.locator('.suggestion-checkbox').first().click();
    await outer.locator('textarea.to-value').first().fill('Change to this suggestion');
    await page.locator('.comment-buttons input[type=submit]').first().click();
    await waitForCommentOnLine(page, 0);
    await enlargeScreen(page, '1000px');
  });

  test.skip('Ensures a comment can be replied', async ({page}) => {
    await createReply(page, false);
  });

  test.skip('Ensures a comment reply can have suggestion', async ({page}) => {
    await createReply(page, true);
    const outer = await getPadOuter(page);
    await expect(outer.locator('.comment-changeTo-form')).toBeVisible();
  });

  test.skip('Clears the comment reply form after submitting a reply with suggestion',
      async ({page}) => {
        await createReply(page, true);
        const outer = await getPadOuter(page);
        const replyForm = outer.locator('form.new-comment');
        expect(await replyForm.locator('.comment-content').textContent()).toBe('');
        expect(await replyForm.locator('.suggestion-checkbox').isChecked()).toBe(false);
        expect(await replyForm.locator('.to-value').textContent()).toBe('');
      });

  test.skip('Replaces the original text with reply suggestion', async ({page}) => {
    await createReply(page, true);
    const outer = await getPadOuter(page);
    const inner = await getPadBody(page);
    await outer.locator(".sidebar-comment-reply .comment-changeTo-form input[type='submit']")
        .first().click();
    await expect.poll(async () =>
      (await inner.locator('div').first().textContent())?.trim()).toBe('My suggestion');
  });

  test.skip('Replaces orig with reply sugg. after replacing orig with comment sugg.',
      async ({page}) => {
        await createReply(page, true);
        const outer = await getPadOuter(page);
        const inner = await getPadBody(page);
        await outer.locator(".sidebar-comment .comment-changeTo-form input[type='submit']")
            .first().click();
        await outer.locator(".sidebar-comment-reply .comment-changeTo-form input[type='submit']")
            .first().click();
        await expect.poll(async () =>
          (await inner.locator('div').first().textContent())?.trim()).toBe('My suggestion');
      });
});
