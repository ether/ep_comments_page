import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter}
    from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {
  aNewCommentsPad,
  highlightSelectedTextEnabled,
  reopenCommentsPad,
  waitForCommentOnLine,
} from '../helper/comments';

const createPadWithTwoLines = async (page: import('@playwright/test').Page) => {
  const inner = await getPadBody(page);
  await inner.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type('Line 1');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Line 2');
  await expect.poll(async () => inner.locator('div').count()).toBeGreaterThanOrEqual(2);
};

const selectLineAndOpenCommentForm = async (
  page: import('@playwright/test').Page, lineIndex: number,
) => {
  const inner = await getPadBody(page);
  await inner.locator('div').nth(lineIndex).click({clickCount: 3});
  await page.locator('.addComment').click();
};

test.describe('ep_comments_page - Pre-comment text mark', () => {
  let padId: string;

  test.beforeEach(async ({page}) => {
    test.setTimeout(60_000);
    padId = await aNewCommentsPad(page);
    await createPadWithTwoLines(page);
    await selectLineAndOpenCommentForm(page, 0);
  });

  test('marks selected text when New Comment form is opened', async ({page}) => {
    if (!(await highlightSelectedTextEnabled(page))) return;
    const inner = await getPadBody(page);
    const marked = inner.locator('.pre-selected-comment');
    await expect(marked).toHaveCount(1);
    expect((await marked.textContent())?.trim()).toBe('Line 1');
  });

  test.describe('when user reloads pad', () => {
    test('does not have any marked text after pad is fully loaded', async ({page}) => {
      if (!(await highlightSelectedTextEnabled(page))) return;
      // Wait for revision to be saved.
      await page.waitForTimeout(5000);
      await reopenCommentsPad(page, padId);
      const inner = await getPadBody(page);
      await expect.poll(async () =>
        inner.locator('.pre-selected-comment').count(), {timeout: 20_000}).toBe(0);
    });
  });

  test.describe('when user performs UNDO operation', () => {
    test('keeps marked text', async ({page}) => {
      if (!(await highlightSelectedTextEnabled(page))) return;
      // Wait for revision and reload.
      await page.waitForTimeout(5000);
      await reopenCommentsPad(page, padId);
      // Re-mark the text.
      await selectLineAndOpenCommentForm(page, 0);
      // Trigger UNDO.
      await page.locator('.buttonicon-undo').click();
      const inner = await getPadBody(page);
      const marked = inner.locator('.pre-selected-comment');
      await expect(marked).toHaveCount(1);
      expect((await marked.textContent())?.trim()).toBe('Line 1');
    });
  });

  test.describe('when user changes selected text', () => {
    test('keeps marked text', async ({page}) => {
      if (!(await highlightSelectedTextEnabled(page))) return;
      const inner = await getPadBody(page);
      // Select the second line.
      await inner.locator('div').nth(1).click({clickCount: 3});
      const marked = inner.locator('.pre-selected-comment');
      await expect(marked).toHaveCount(1);
      expect((await marked.textContent())?.trim()).toBe('Line 1');
    });
  });

  test.describe('when user closes the New Comment form', () => {
    test('unmarks text', async ({page}) => {
      if (!(await highlightSelectedTextEnabled(page))) return;
      const outer = await getPadOuter(page);
      await outer.locator('#comment-reset').click();
      const inner = await getPadBody(page);
      await expect(inner.locator('.pre-selected-comment')).toHaveCount(0);
    });
  });

  test.describe('when user submits the comment', () => {
    test('unmarks text', async ({page}) => {
      if (!(await highlightSelectedTextEnabled(page))) return;
      const outer = await getPadOuter(page);
      await page.locator('textarea.comment-content').fill('My comment');
      await outer.locator('.label-suggestion-checkbox').first().click();
      await outer.locator('textarea.to-value').first().fill('Change to this suggestion');
      await page.locator('.comment-buttons input[type=submit]').first().click();
      await waitForCommentOnLine(page, 0);
      const inner = await getPadBody(page);
      await expect(inner.locator('.pre-selected-comment')).toHaveCount(0);
    });
  });

  test.describe('when user selects another text range and opens New Comment form for it', () => {
    test('changes the marked text', async ({page}) => {
      if (!(await highlightSelectedTextEnabled(page))) return;
      await selectLineAndOpenCommentForm(page, 1);
      const inner = await getPadBody(page);
      const marked = inner.locator('.pre-selected-comment');
      await expect(marked).toHaveCount(1);
      expect((await marked.textContent())?.trim()).toBe('Line 2');
    });
  });
});
