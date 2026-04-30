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
    await page.locator('#newComment .label-suggestion-checkbox').first().click();
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
    // The display-suggestion block now renders four sibling spans
    // (from-label / from-value / to-label / to-value) instead of a single
    // string with {{changeFrom}} / {{changeTo}} placeholders, so the
    // assertion covers the assembled text rather than a single key.
    //
    // Until translatewiki syncs `suggested_change_from_label` and
    // `suggest_change_to_label` for non-English locales, those labels fall
    // back to English even when the page locale is pt-br (tracked in
    // ether/ep_comments_page#379). The values themselves do not depend on
    // locale, so we still assert they round-trip into the rendered DOM.
    const block = outer.locator(`#${commentId} .suggestion-display`).first();
    expect((await block.locator('.from-label').first().textContent() || '').trim())
        .not.toBe('');
    expect((await block.locator('.from-value').first().textContent() || '').trim())
        .toBe(commentedText);
    expect((await block.locator('.to-value').first().textContent() || '').trim())
        .toBe(suggestedText);
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
