import {expect, test} from '@playwright/test';
import {getPadOuter} from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {
  aNewCommentsPad,
  addCommentToLine,
  chooseToShowComments,
  displayCommentAsIcon,
  enlargeScreen,
  setPadLines,
} from '../helper/comments';

test.describe('ep_comments_page - Multiple comments on one line', () => {
  test('stacks sidebar comments so each one is visible', async ({page}) => {
    test.setTimeout(60_000);
    await aNewCommentsPad(page);
    if (await displayCommentAsIcon(page)) test.skip();
    await enlargeScreen(page);
    await chooseToShowComments(page, true);
    await setPadLines(page, ['This line has multiple comments']);

    await addCommentToLine(page, 0, 'First comment');
    await addCommentToLine(page, 0, 'Second comment');

    const outer = await getPadOuter(page);
    const sidebarComments = outer.locator('#comments .sidebar-comment');
    await expect(sidebarComments).toHaveCount(2);

    const positions = await outer.evaluate(() => {
      const comments = Array.from(document.querySelectorAll('#comments .sidebar-comment'));
      return comments.map((comment) => {
        const rect = comment.getBoundingClientRect();
        return {top: rect.top, height: rect.height};
      });
    });
    const sortedByTop = positions.sort((a, b) => a.top - b.top);
    expect(sortedByTop[1].top).toBeGreaterThanOrEqual(
        sortedByTop[0].top + sortedByTop[0].height);
  });
});
