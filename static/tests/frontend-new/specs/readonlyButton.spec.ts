import {expect, test} from '@playwright/test';
import {aNewCommentsPad} from '../helper/comments';

// Issue #204: the "Add comment" toolbar button must not appear on read-only
// pads. Marking it `acl-write` lets Etherpad core hide it via its existing
// `.readonly .acl-write { display: none }` rule (present on every supported
// core, so this works on the latest release and on develop).
test.describe('ep_comments_page - read-only', () => {
  test('the add-comment button is hidden on read-only pads (#204)', async ({page}) => {
    await aNewCommentsPad(page);

    // Visible on the writable pad.
    await expect(page.locator('.addComment')).toBeVisible();

    const readOnlyId: string = await page.evaluate(() => (window as any).clientVars.readOnlyId);
    expect(readOnlyId).toMatch(/^r\./);

    // Open the read-only view of the same pad. (Don't use the goToPad helper —
    // its waitForEditorReady never settles on a read-only pad.)
    await page.goto(`http://localhost:9001/p/${readOnlyId}`);
    await page.locator('iframe[name="ace_outer"]').waitFor({timeout: 30_000});

    await expect(page.locator('body')).toHaveClass(/readonly/);
    await expect(page.locator('.addComment')).toBeHidden();
  });
});
