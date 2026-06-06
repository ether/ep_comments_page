import {expect, test} from '@playwright/test';
import {getPadBody, getPadOuter}
    from 'ep_etherpad-lite/tests/frontend-new/helper/padHelper';
import {aNewCommentsPad, reopenCommentsPad} from '../helper/comments';

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
  // Captured from aNewCommentsPad so tests don't re-parse the padId out of the
  // URL (#188).
  let padId: string;
  test.beforeEach(async ({page}) => {
    test.setTimeout(60_000);
    padId = await aNewCommentsPad(page);
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
    // The suggested ("to") text now lives in its own .to-value span, not
    // inside the localized label — the placeholder-laden key was retired
    // (see #379). Assert the value round-trips into that span (special
    // chars and all) instead of substring-matching the label.
    await expect.poll(async () => {
      const t = await outer.locator('.comment-container .comment-title-wrapper .to-value')
          .first().textContent();
      return (t || '').trim();
    }).toBe(suggestedText);

    await outer.locator('.approve-suggestion-btn:visible').first().click();
    await expect.poll(async () =>
      (await inner.locator('div').first().locator('.comment').textContent())?.trim())
        .toBe(suggestedText);
  });

  // #188: "Suggestion text does not display". The original report was that the
  // proposed ("to") text did not render in the comment box — only the
  // {{changeTo}} placeholder showed — even though applying the change replaced
  // the text correctly. Fixed by #369/#378 (the value now lives in its own
  // .to-value span instead of a placeholder-substituted label). The existing
  // test above covers the just-created in-memory render; this one guards the
  // *persisted display* path by reloading the pad and reopening the comment,
  // which rebuilds the box from getComments rather than the create flow.
  test('Displays the suggested text after reload (#188)', async ({page}) => {
    const inner = await getPadBody(page);
    const suggestedText = 'the proposed replacement text';

    // Type real text (not the innerHTML-injection helper) so the comment
    // attribute survives a full reload, then select it and open the form.
    await inner.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.type('This content will receive a comment');
    await page.keyboard.press('Control+A');
    await page.locator('.addComment').first().click();
    await expect.poll(async () =>
      page.locator('#newComment.popup-show .suggestion-checkbox').count()).toBeGreaterThan(0);
    await page.locator('#newComment.popup-show .label-suggestion-checkbox').first().click();

    await expect(page.locator('#newComment.popup-show')).toBeVisible();
    await page.locator('#newComment textarea.comment-content').fill('A comment');
    await expect.poll(async () =>
      page.locator('#newComment textarea.to-value').count()).toBeGreaterThan(0);
    await page.locator('#newComment textarea.to-value').fill(suggestedText);
    await page.locator('#comment-create-btn').click();
    await expect.poll(async () =>
      inner.locator('div').first().locator('.comment').count()).toBeGreaterThan(0);

    // Wait for the comment+suggestion to be persisted server-side before
    // reloading: DOM presence in this session doesn't guarantee the save has
    // round-tripped, and reloading too early can race persistence and load a
    // pad that lacks the comment (flaky false failure). Poll the comments
    // socket until the suggestion data is actually stored.
    await expect.poll(async () => page.evaluate(async () => {
      const ep = (window as any).pad?.plugins?.ep_comments_page;
      if (!ep) return false;
      const res = await ep.getComments();
      const comments = res && res.comments ? res.comments : res;
      return !!comments && Object.values(comments).some((c: any) => c && c.changeTo);
    }), {timeout: 15_000}).toBe(true);

    // The metadata poll above only proves the comment record is stored. The
    // inline highlight (and thus the rebuilt box) is reconstructed from the pad
    // atext's `comment` attribute on reload, so also wait for the pad changeset
    // that applies that attribute to be committed — i.e. the collab revision
    // stops advancing. Reopening before that races persistence and loads a pad
    // whose text carries no comment attribute (the flaky failure).
    let lastRev = -1;
    await expect.poll(async () => {
      const rev = await page.evaluate(() =>
        (window as any).pad?.getCollabRevisionNumber?.() ?? -1);
      const stable = rev >= 1 && rev === lastRev;
      lastRev = rev;
      return stable;
    }, {timeout: 15_000, intervals: [500]}).toBe(true);

    // Reload the pad as a fresh page load so the comment box is rebuilt from
    // the server data (collectComments), not the create-time DOM.
    await reopenCommentsPad(page, padId);

    const innerAfter = await getPadBody(page);
    const outerAfter = await getPadOuter(page);
    await expect.poll(async () =>
      innerAfter.locator('div').first().locator('.comment').count()).toBeGreaterThan(0);

    // The suggestion box is pre-built in the sidebar on collect; the proposed
    // text lives in its own .to-value span (textContent is present even while
    // the box is collapsed). #188 was that this text was missing / showed the
    // literal {{changeTo}} placeholder.
    await expect.poll(async () => {
      const t = await outerAfter.locator('.comment-container .comment-title-wrapper .to-value')
          .first().textContent();
      return (t || '').trim();
    }, {timeout: 15_000}).toBe(suggestedText);
    const titleText = await outerAfter.locator('.comment-container .comment-title-wrapper')
        .first().textContent();
    expect(titleText).not.toContain('{{');
  });

  // #380: the suggestion value spans used to be rendered at opacity: .8, which
  // alpha-blends the text against an unknown skin background and can drop below
  // WCAG AA on darker/branded skins. The fix removes the opacity so the value
  // inherits the skin's full-strength text color. Guard against the regression
  // by computing the actual rendered contrast ratio (not just opacity) of the
  // value text against its effective background, and asserting it meets
  // WCAG 2.1 AA (>= 4.5:1) on the default colibris skin.
  test('Suggestion value spans meet WCAG AA contrast (#380)',
      async ({page}) => {
        const outer = await getPadOuter(page);
        const inner = await getPadBody(page);
        const suggestedText = 'a contrast-safe suggestion';
        await openCommentFormWithSuggestion(page, 'This content will receive a comment');
        await expect(page.locator('#newComment.popup-show')).toBeVisible();
        await page.locator('#newComment textarea.comment-content').fill('A comment');
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

        // Compute the rendered contrast ratio of a value span against its
        // effective (first opaque ancestor) background, the way a browser
        // actually paints it — this catches both the old opacity regression
        // and any future colour change that fails AA.
        const contrastOf = async (selector: string) =>
          outer.locator(selector).first().evaluate((el) => {
            const parse = (c: string) => {
              const m = c.match(/[\d.]+/g)!.map(Number);
              return {r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3]};
            };
            // Effective text colour folds the element's own opacity in.
            const cs = getComputedStyle(el);
            const fg = parse(cs.color);
            const opacity = parseFloat(cs.opacity);
            // Walk ancestors for the first opaque background colour.
            let bg = {r: 255, g: 255, b: 255, a: 1};
            let node: HTMLElement | null = el as HTMLElement;
            while (node) {
              const c = parse(getComputedStyle(node).backgroundColor);
              if (c.a > 0) { bg = c; break; }
              node = node.parentElement;
            }
            // Blend fg (with its opacity) over bg.
            const blend = (f: number, b: number) => f * opacity + b * (1 - opacity);
            const rgb = {r: blend(fg.r, bg.r), g: blend(fg.g, bg.g), b: blend(fg.b, bg.b)};
            const lum = (c: {r: number, g: number, b: number}) => {
              const ch = (v: number) => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
              };
              return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
            };
            const l1 = lum(rgb); const l2 = lum(bg);
            return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
          });

        expect(await contrastOf('.suggestion-display .from-value')).toBeGreaterThanOrEqual(4.5);
        expect(await contrastOf('.suggestion-display .to-value')).toBeGreaterThanOrEqual(4.5);
      });
});
