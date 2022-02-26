'use strict';

const AttributePool = require('ep_etherpad-lite/static/js/AttributePool');
const Changeset = require('ep_etherpad-lite/static/js/Changeset');
const assert = require('assert').strict;
const common = require('ep_etherpad-lite/tests/backend/common');
const padManager = require('ep_etherpad-lite/node/db/PadManager');
const readOnlyManager = require('ep_etherpad-lite/node/db/ReadOnlyManager');
const shared = require('../../../js/shared.js');

describe(__filename, function () {
  let agent;
  let pad;
  let padId;
  let roPadId;
  let socket;

  const makeUserChanges = (opcode, attribs) => {
    const oldLen = pad.text().length;
    assert(oldLen > 0);
    const apool = new AttributePool();
    const op = Changeset.newOp(opcode);
    op.chars = 1;
    op.attribs = Changeset.makeAttribsString(opcode, attribs, apool);
    const assem = Changeset.smartOpAssembler();
    assem.append(op);
    const cs = assem.toString();
    const newLen = oldLen + assem.getLengthChange();
    const changeset = Changeset.pack(oldLen, newLen, cs, opcode === '+' ? 'x' : '');
    return {baseRev: pad.head, changeset, apool: apool.toJsonable()};
  };

  before(async function () {
    agent = await common.init();
  });

  beforeEach(async function () {
    padId = `testpad${common.randomString()}`;
    assert(!await padManager.doesPadExist(padId));
    pad = await padManager.getPad(padId, 'text');
    assert(pad.text().startsWith('text'));
    roPadId = await readOnlyManager.getReadOnlyId(padId);
    const res = await agent.get(`/p/${roPadId}`).expect(200);
    socket = await common.connect(res);
    const {type, data: clientVars} = await common.handshake(socket, roPadId);
    assert.equal(type, 'CLIENT_VARS');
    assert(clientVars.readonly);
    assert.equal(clientVars.readOnlyId, roPadId);
  });

  afterEach(async function () {
    if (socket != null) socket.close();
    socket = null;
    if (pad != null) await pad.remove();
    pad = null;
  });

  describe('comment-only changes are accepted', function () {
    it('add/change comment attribute', async function () {
      await Promise.all([
        common.waitForAcceptCommit(socket, pad.head + 1),
        common.sendUserChanges(
            socket, makeUserChanges('=', [['comment', shared.generateCommentId()]])),
      ]);
    });

    it('remove comment attribute', async function () {
      await Promise.all([
        common.waitForAcceptCommit(socket, pad.head + 1),
        common.sendUserChanges(
            socket, makeUserChanges('=', [['comment', shared.generateCommentId()]])),
      ]);
      await Promise.all([
        common.waitForAcceptCommit(socket, pad.head + 1),
        common.sendUserChanges(socket, makeUserChanges('=', [['comment', '']])),
      ]);
    });
  });

  describe('other changes are rejected', function () {
    const testCases = [
      {
        desc: 'keep with non-comment attrib add/change',
        opcode: '=',
        attribs: [['bold', 'true']],
      },
      {
        desc: 'keep with non-comment attrib removal',
        opcode: '=',
        attribs: [['bold', '']],
      },
      {
        desc: 'keep with comment and non-comment attrib adds/changes',
        opcode: '=',
        attribs: [['comment', shared.generateCommentId()], ['bold', 'true']],
      },
      {
        desc: 'insert with no attribs',
        opcode: '+',
        attribs: [],
      },
      {
        desc: 'insert with comment attrib',
        opcode: '+',
        attribs: [['comment', shared.generateCommentId()]],
      },
      {
        desc: 'insert with non-comment attrib',
        opcode: '+',
        attribs: [['bold', 'true']],
      },
      {
        desc: 'insert with comment and non-comment attribs',
        opcode: '+',
        attribs: [['comment', shared.generateCommentId()], ['bold', 'true']],
      },
      {
        desc: 'remove',
        opcode: '-',
        attribs: [],
      },
    ];

    for (const {desc, opcode, attribs} of testCases) {
      it(desc, async function () {
        const head = pad.head;
        await assert.rejects(common.sendUserChanges(socket, makeUserChanges(opcode, attribs)));
        // common.sendUserChanges() waits for message ack, so if the message was accepted then head
        // should have already incremented by the time we get here.
        assert.equal(pad.head, head);
      });
    }
  });
});
