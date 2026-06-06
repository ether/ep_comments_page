import {expect, test} from '@playwright/test';
import {getPadBody} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad} from '../helper/comments';

// #190: comments were lost when exporting to rich formats. The plugin's export
// hooks (getLineHTMLForExport + exportHTMLAdditionalContent) put the comments
// into the HTML document that every rich format (odt/doc/pdf/docx) is rendered
// from, so they survive the conversion. This spec exercises the HTML export
// (deterministic, no soffice dependency) and verifies the comments are present
// and footnote-numbered so they stay correlatable once the anchor is flattened.
test.describe('ep_comments_page - Export comments (#190)', () => {
  test.beforeEach(({page}) => { test.setTimeout(60_000); void page; });

  const addComment = async (
    page: import('@playwright/test').Page, lineIndex: number, commentText: string,
  ) => {
    const inner = await getPadBody(page);
    // Select the line and open the form. Retry the trigger until the popup
    // shows — the triple-click selection occasionally races the toolbar.
    await expect.poll(async () => {
      await inner.locator('div').nth(lineIndex).click({clickCount: 3});
      await page.locator('.addComment').click();
      return page.locator('#newComment.popup-show').count();
    }, {timeout: 20_000}).toBeGreaterThan(0);
    await page.locator('#newComment textarea.comment-content').fill(commentText);
    await page.locator('#comment-create-btn').click();
    // Wait for the inline highlight to appear before moving on.
    await expect.poll(async () =>
      inner.locator('div').nth(lineIndex).locator('.comment').count()).toBeGreaterThan(0);
  };

  test('comments are exported into the HTML document', async ({page}) => {
    const padId = await aNewCommentsPad(page);
    const inner = await getPadBody(page);
    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('First commented line');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second commented line');

    await addComment(page, 0, 'FIRST_COMMENT_MARKER');
    await addComment(page, 1, 'SECOND_COMMENT_MARKER');

    const base = page.url().split('/p/')[0];
    const html: string = await page.evaluate(async (url) =>
      await (await fetch(url)).text(), `${base}/p/${padId}/export/html`);

    // Both comment texts must be present in the exported document.
    expect(html).toContain('FIRST_COMMENT_MARKER');
    expect(html).toContain('SECOND_COMMENT_MARKER');
    // A recognisable comments section survives for flattened formats.
    expect(html).toContain('<div id="comments">');
    expect(html).toContain('Comments');
    // Footnote markers are numbered (not all "*") so they stay correlatable
    // once the #id anchor is lost in odt/doc/pdf.
    expect(html).toContain('[1]');
    expect(html).toContain('[2]');
    // Inline markers link to the comment ids.
    expect(html).toMatch(/<sup><a href="#c-[0-9a-zA-Z]+">\[1\]<\/a><\/sup>/);
    // Each comment line carries its number, author and text in the section.
    expect(html).toMatch(/\[1\][^<]*FIRST_COMMENT_MARKER/);
    expect(html).toMatch(/\[2\][^<]*SECOND_COMMENT_MARKER/);
  });
});
