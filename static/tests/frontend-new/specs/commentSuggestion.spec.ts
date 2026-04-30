import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter}
    from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// Replace pad content with raw HTML and select all (mirrors legacy
// `$firstTextElement.html(targetText).sendkeys('{selectall}')`).
const setHtmlAndSelectAll = async (
  page: import('@playwright/test').Page, html: string,
) => {
  const inner = await getPadBody(page);
  await inner.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  // Inject raw HTML into the first line.
  await inner.evaluate((root, h) => {
    const first = root.querySelector('div');
    if (first) first.innerHTML = h;
  }, html);
  // Select-all so the addComment button selection covers the inserted content.
  await inner.click();
  await page.keyboard.press('Control+A');
};

const openCommentFormWithSuggestion = async (
  page: import('@playwright/test').Page, targetText: string,
) => {
  await setHtmlAndSelectAll(page, targetText);
  await page.locator('.addComment').first().click();
  await expect.poll(async () =>
    page.locator('#newComment.popup-show .suggestion-checkbox').count()).toBeGreaterThan(0);
  await page.locator('#newComment.popup-show .label-suggestion-checkbox').first().click();
};

test.describe('ep_comments_page - Comment Suggestion', () => {
  test.beforeEach(async ({page}) => {
    test.setTimeout(60_000);
    await aNewCommentsPad(page);
  });

  test('Fills suggestion Change From field when adding a comment with suggestion',
      async ({page}) => {
        const targetText =
            '<span>A</span><ul><li> text with</li><li> line attributes</li></ul>';
        await openCommentFormWithSuggestion(page, targetText);
        const text = await page.locator('.from-value').textContent();
        expect(text).toBe('A\n text with\n line attributes');
      });

  test('Cancel suggestion and try again fills suggestion Change From field',
      async ({page}) => {
        const outer = await getPadOuter(page);
        await openCommentFormWithSuggestion(page, 'This content will receive a comment');
        await page.locator('#comment-reset').click();
        await expect.poll(async () =>
          outer.locator('#newComments.active').count()).toBe(0);
        await openCommentFormWithSuggestion(page, 'New target for comment');
        const text = await page.locator('.from-value').textContent();
        expect(text).toBe('New target for comment');
      });

  test('Fills suggestion Change From field, adds sugestion', async ({page}) => {
    const inner = await getPadBody(page);
    const outer = await getPadOuter(page);
    const origText = 'This content will receive a comment';
    const suggestedText = 'amp: & dq: " sq: \' lt: < gt: > bs: \\ end';
    await openCommentFormWithSuggestion(page, origText);

    await expect(page.locator('#newComment.popup-show')).toBeVisible();
    await page.locator('#newComment textarea.comment-content').fill('A new comment text');
    // Legacy bug-compatible selector: chrome$('#newComment').find('suggestion-checkbox').click()
    // — that selector is invalid (missing dot) and matches nothing, but the suggestion
    // checkbox was already clicked inside openCommentFormWithSuggestion above, so the
    // textarea.to-value is already visible.
    await expect.poll(async () =>
      page.locator('#newComment textarea.to-value').count()).toBeGreaterThan(0);
    await page.locator('#newComment textarea.to-value').fill(suggestedText);
    await page.locator('#comment-create-btn').click();

    await expect.poll(async () =>
      inner.locator('div').first().locator('.comment').count()).toBeGreaterThan(0);
    await inner.locator('div').first().locator('.comment').first().click();
    await expect.poll(async () =>
      outer.locator('.comment-container .full-display-content:visible').count())
        .toBeGreaterThan(0);
    await expect.poll(async () => {
      const t = await outer.locator('.comment-container .comment-title-wrapper .from-label')
          .first().textContent();
      return t && t.includes(suggestedText);
    }).toBe(true);

    await outer.locator('.approve-suggestion-btn:visible').first().click();
    await expect.poll(async () =>
      (await inner.locator('div').first().locator('.comment').textContent())?.trim())
        .toBe(suggestedText);
  });
});
