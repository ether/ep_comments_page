import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter}
    from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {
  aNewCommentsPad,
  chooseToShowComments,
} from '../helper/comments';

// Faithful 1:1 port — all original tests were xit (skipped) in the legacy spec.
test.describe('ep_comments_page - Comment settings', () => {
  test.describe("when user unchecks 'Show Comments'", () => {
    test.beforeEach(async ({page}) => {
      test.setTimeout(60_000);
      await aNewCommentsPad(page);
      await chooseToShowComments(page, false);
    });

    test.skip('sidebar comments should not be visible when opening a new pad',
        async ({page}) => {
          // Force a new pad for validation on a brand new pad.
          await aNewCommentsPad(page);
          const outer = await getPadOuter(page);
          await expect(outer.locator('#comments')).toBeHidden();
        });

    test.skip('sidebar comments not visible when adding a new comment to a new pad',
        async ({page}) => {
          await aNewCommentsPad(page);
          const inner = await getPadBody(page);
          const outer = await getPadOuter(page);
          await inner.click();
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Delete');
          await page.keyboard.type('This content will receive a comment');
          await inner.locator('div').first().click({clickCount: 3});
          await page.locator('.addComment').first().click();
          await page.locator('textarea.comment-content').fill('My comment');
          await outer.locator('.suggestion-checkbox').first().click();
          await outer.locator('textarea.to-value').first().fill('Change to this suggestion');
          await page.locator('.comment-buttons input[type=submit]').first().click();
          // After creating the comment, click Add Comment again — sidebar must remain hidden.
          await inner.locator('div').first().click({clickCount: 3});
          await page.locator('.addComment').first().click();
          expect(await outer.locator('#comments:visible').count()).toBe(0);
        });
  });
});
