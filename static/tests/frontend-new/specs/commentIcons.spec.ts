import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter}
    from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {
  aNewCommentsPad,
  chooseToShowComments,
  displayCommentAsIcon,
  enlargeScreen,
  getCommentIdOfLine,
  setPadLines,
  waitForCommentOnLine,
} from '../helper/comments';

const COMMENT_TEXT = 'This content will receive a comment';

const addCommentNoSelect = async (page: import('@playwright/test').Page, text: string) => {
  const inner = await getPadBody(page);
  const before = await inner.locator('.comment').count();
  await page.locator('.addComment').first().click();
  await page.locator('textarea.comment-content').fill(text);
  await page.locator('.comment-buttons input[type=submit]').first().click();
  await expect.poll(async () => inner.locator('.comment').count())
      .toBeGreaterThan(before);
};

test.describe('ep_comments_page - Comment icons', () => {
  test.beforeEach(async ({page}) => {
    test.setTimeout(60_000);
    await aNewCommentsPad(page);
    if (!(await displayCommentAsIcon(page))) test.skip();
    // Smaller width — legacy used 1000px for icon tests.
    await enlargeScreen(page, '1000px');
    await chooseToShowComments(page, true);
    // Create the initial commented line.
    await setPadLines(page, [COMMENT_TEXT]);
    const inner = await getPadBody(page);
    // Select the line and add comment.
    await inner.locator('div').first().click({clickCount: 3});
    await addCommentNoSelect(page, 'My comment');
    await waitForCommentOnLine(page, 0);
  });

  test('adds a comment icon on the same height of commented text', async ({page}) => {
    const inner = await getPadBody(page);
    const outer = await getPadOuter(page);
    const commentId = (await getCommentIdOfLine(page, 0))!;
    const icon = outer.locator(`#commentIcons #icon-${commentId}`);
    await expect(icon).toHaveCount(1);
    const iconTop = (await icon.boundingBox())!.y;
    const textTop = (await inner.locator(`.${commentId}`).first().boundingBox())!.y;
    // Legacy: icons are +5px down to adjust position.
    expect(Math.round(iconTop)).toBe(Math.round(textTop + 5));
  });

  // Legacy was xit('does not show comment icon when commented text is removed')
  test.skip('does not show comment icon when commented text is removed', async () => {});
  // Legacy was xit('does not show comment icon when comment is deleted')
  test.skip('does not show comment icon when comment is deleted', async () => {});

  test('updates comment icon height when commented text is moved to another line',
      async ({page}) => {
        const inner = await getPadBody(page);
        const outer = await getPadOuter(page);
        const commentId = (await getCommentIdOfLine(page, 0))!;

        await inner.locator('div').first().click();
        await page.keyboard.press('Home');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');

        await expect.poll(async () => inner.locator('div').count()).toBeGreaterThan(2);
        await expect.poll(async () =>
          outer.locator('#commentIcons .comment-icon').count()).toBeGreaterThan(0);

        const icon = outer.locator(`#commentIcons #icon-${commentId}`);
        const iconTop = (await icon.boundingBox())!.y;
        const textTop = (await inner.locator(`.${commentId}`).first().boundingBox())!.y;
        expect(Math.round(iconTop)).toBe(Math.round(textTop + 5));
      });

  test('shows comment when user clicks on comment icon', async ({page}) => {
    const outer = await getPadOuter(page);
    const commentId = (await getCommentIdOfLine(page, 0))!;
    await outer.locator(`#commentIcons #icon-${commentId}`).first().click();
    await expect(outer.locator('#comments .sidebar-comment:visible')).toHaveCount(1);
  });

  test('hides comment when user clicks on comment icon twice', async ({page}) => {
    const outer = await getPadOuter(page);
    const commentId = (await getCommentIdOfLine(page, 0))!;
    const icon = outer.locator(`#commentIcons #icon-${commentId}`).first();
    await icon.click();
    await icon.click();
    await expect(outer.locator('#comments .sidebar-comment:visible')).toHaveCount(0);
  });

  test('hides comment when user clicks outside of comment box', async ({page}) => {
    const outer = await getPadOuter(page);
    const commentId = (await getCommentIdOfLine(page, 0))!;
    await outer.locator(`#commentIcons #icon-${commentId}`).first().click();
    await outer.locator('#outerdocbody').click();
    await expect(outer.locator('#comments .sidebar-comment:visible')).toHaveCount(0);
  });

  test('hides 1st, shows 2nd comment when user clicks on one then another icon',
      async ({page}) => {
        const inner = await getPadBody(page);
        const outer = await getPadOuter(page);

        // Add a second line and a second comment.
        await inner.locator('div').last().click();
        await page.keyboard.press('End');
        await page.keyboard.type('Second line');
        await page.keyboard.press('Enter');
        await expect.poll(async () => inner.locator('div').count()).toBeGreaterThan(2);

        const second = inner.locator('div').nth(1);
        await second.click({clickCount: 3});
        await addCommentNoSelect(page, 'Second Comment');
        await waitForCommentOnLine(page, 1);

        const id0 = (await getCommentIdOfLine(page, 0))!;
        const id1 = (await getCommentIdOfLine(page, 1))!;
        await outer.locator(`#commentIcons #icon-${id0}`).first().click();
        await outer.locator(`#commentIcons #icon-${id1}`).first().click();

        const visibleText = await outer.locator('#comments .sidebar-comment:visible .comment-text')
            .first().textContent();
        expect((visibleText || '').trim()).toBe('Second Comment');
      });
});
