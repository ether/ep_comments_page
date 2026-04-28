import {test} from '@playwright/test';

// Faithful 1:1 port — every test in the legacy spec was xit (skipped) because
// the copy/paste flow could not be reliably triggered headlessly. We preserve
// the test names with test.skip so the migration is visible in CI.

test.describe('ep_comments_page - Comment copy and paste', () => {
  test.describe('when user copies a text with a comment', () => {
    test.skip('keeps the text copied on the buffer', async () => {});
    test.skip('generates a fake comment class', async () => {});
    test.skip('puts the comment data on the clipboardData', async () => {});
    test.skip('puts the comment reply data on the clipboardData', async () => {});
    test.skip('has the fields required to build a comment', async () => {});
    test.skip('has the fields required to build a comment reply', async () => {});
  });

  test.describe('when user pastes a text with comment', () => {
    test.skip('generates a different comment id for the comment pasted', async () => {});
    test.skip('creates a new icon for the comment pasted', async () => {});
    test.skip('creates the comment text field with the same text of the one copied',
        async () => {});
    test.skip('creates comment reply text field with the same text of the one copied',
        async () => {});

    test.describe('when user removes the original comment', () => {
      test.skip('does not remove the comment pasted', async () => {});
    });
  });
});
