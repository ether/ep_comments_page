'use strict';

exports.aNewPad = async (...args) => {
  const padId = await helper.aNewPad(...args);
  // Most ep_comments_page initialization happens during postAceInit, which runs after
  // helper.aNewPad() returns. Wait for initialization to complete to avoid race conditions.
  await helper.waitForPromise(async () => {
    const {plugins: {ep_comments_page: {initDone} = {}} = {}} = helper.padChrome$.window.pad;
    if (!initDone) return false;
    await initDone;
    return true;
  });
  return padId;
};
