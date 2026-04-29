import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter}
    from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {
  aNewCommentsPad,
  changeLanguageTo,
  getCommentIdOfLine,
  setPadLines,
  waitForCommentOnLine,
} from '../helper/comments';

const commentedText = 'This content will receive a comment';
const suggestedText = 'Change to this suggestion';

test.describe('ep_comments_page - l10n', () => {
  test.beforeEach(async ({page}) => {
    test.setTimeout(60_000);
    await aNewCommentsPad(page);
    await setPadLines(page, [commentedText]);
    const inner = await getPadBody(page);
    await inner.locator('div').first().click({clickCount: 3});
    await page.locator('.addComment').first().click();
    await page.locator('textarea.comment-content').fill('My comment');
    await page.locator('#newComment .suggestion-checkbox').first().click();
    await page.locator('textarea.to-value').fill(suggestedText);
    await page.locator('.comment-buttons input[type=submit]').first().click();
    await waitForCommentOnLine(page, 0);
    await changeLanguageTo(page, 'en');
  });

  test.afterEach(async ({page}) => {
    // Restore English to avoid breaking other tests.
    await changeLanguageTo(page, 'en');
  });

  test('uses default values when language was not localized yet', async ({page}) => {
    await changeLanguageTo(page, 'oc');
    const outer = await getPadOuter(page);
    const text = await outer.locator('.comment-suggest').first().textContent();
    expect(text).toBe(
        '                                  Include suggested change             ');
  });

  test('localizes comment when Etherpad language is changed', async ({page}) => {
    await changeLanguageTo(page, 'pt-br');
    const outer = await getPadOuter(page);
    const commentId = await getCommentIdOfLine(page, 0);
    const text = await outer.locator(`#${commentId} .from-label`).first().textContent();
    expect(text).toBe(`Alteração sugerida de "${commentedText}" para "${suggestedText}"`);
  });

  test("localizes 'new comment' form when Etherpad language is changed", async ({page}) => {
    const inner = await getPadBody(page);
    const outer = await getPadOuter(page);
    // Select again and re-open the new-comment form.
    await inner.locator('div').first().click({clickCount: 3});
    await page.locator('.addComment').first().click();
    await changeLanguageTo(page, 'pt-br');
    const txt = await outer.locator('.new-comment label.label-suggestion-checkbox').first()
        .textContent();
    expect((txt || '').trim()).toBe('Incluir alteração sugerida');
  });
});
