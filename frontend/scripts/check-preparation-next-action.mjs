import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizePreparationFacts, preparationTasks, selectPreparationAction } from '../src/utils/preparationNextAction.js';
import { premiumCopy } from '../src/content/premiumWorkspaceCopy.js';
let count = 0;
const check = (name, fn) => {
  fn();
  count++;
  console.log('PASS ' + name);
};
const base = {
  userId: 27,
  context: {
    case_id: 7,
    case: {
      id: 7,
      owner_user_id: 27,
      case_title: 'Synthetic',
      application_type: 'permanent_residence'
    },
    family_size: 2
  }
};
const saved = {
  user_id: 27,
  application_case_id: 7,
  intake_payload: {
    note: 'Existing'
  },
  updated_at: '2026-10-01T00:00:00Z'
};
const draft = {
  case_id: 7,
  revision: 2,
  title: 'Recorded draft'
};
const doc = {
  user_id: 27,
  matter_type: 'case_7',
  completed: false
};
const normalize = extra => normalizePreparationFacts({
  ...base,
  ...extra
});
check('authoritative case', () => assert.equal(normalize().caseId, 7));
for (const context of [null, {}, {
  ...base.context,
  case_id: 8
}, {
  ...base.context,
  case: {
    ...base.context.case,
    owner_user_id: 11
  }
}]) check('reject unverified context ' + count, () => assert.throws(() => normalize({
  context
})));
for (const userId of [null, '27', 11]) check('reject identity ' + userId, () => assert.throws(() => normalize({
  ...base,
  userId
})));
check('recorded household not inferred', () => assert.equal(normalize().people, 2));
check('unknown household', () => assert.equal(normalize({
  context: {
    ...base.context,
    family_size: null
  }
}).people, null));
check('PR not Express Entry', () => assert.equal(normalize().caseType, 'permanent_residence'));
check('absent language is unknown', () => assert.equal(normalize().languageState, 'unknown'));
check('unselected language is unknown', () => assert.equal(normalize({
  language: {
    selected: {
      en: null
    },
    assessments: []
  }
}).languageState, 'unknown'));
check('selected unusable needs review', () => assert.equal(normalize({
  language: {
    selected: {
      en: 1
    },
    assessments: [{
      id: 1,
      usable: false
    }]
  }
}).languageState, 'needs_review'));
check('selected usable is recorded not eligible', () => assert.equal(normalize({
  language: {
    selected: {
      en: 1
    },
    assessments: [{
      id: 1,
      usable: true
    }]
  }
}).languageState, 'recorded'));
check('legacy unselected scores do not invent evidence', () => assert.equal(normalize({
  profile: {
    language_score: 9
  }
}).languageState, 'unknown'));
check('saved presence is recorded only', () => assert.equal(normalize({
  saved
}).saved, saved));
check('saved case mismatch', () => assert.throws(() => normalize({
  saved: {
    ...saved,
    application_case_id: 8
  }
})));
check('saved account mismatch', () => assert.throws(() => normalize({
  saved: {
    ...saved,
    user_id: 11
  }
})));
check('saved malformed payload', () => assert.throws(() => normalize({
  saved: {
    ...saved,
    intake_payload: []
  }
})));
check('draft foreign case', () => assert.throws(() => normalize({
  drafts: [{
    ...draft,
    case_id: 8
  }]
})));
check('draft malformed revision', () => assert.throws(() => normalize({
  drafts: [{
    ...draft,
    revision: '2'
  }]
})));
check('document foreign owner', () => assert.throws(() => normalize({
  documents: [{
    ...doc,
    user_id: 11
  }]
})));
check('legacy documents excluded', () => assert.equal(normalize({
  documents: [{
    ...doc,
    matter_type: 'legacy'
  }]
}).documents.length, 0));
check('other case documents excluded', () => assert.equal(normalize({
  documents: [{
    ...doc,
    matter_type: 'case_8'
  }]
}).documents.length, 0));
check('no missing completion inference', () => assert.equal(normalize({
  documents: [doc]
}).documents[0].completed, false));
check('unavailable documents stay unknown', () => assert.equal(normalize().documents, null));
const facts = normalize({
  saved,
  drafts: [draft],
  documents: [doc],
  language: {
    selected: {
      en: 1
    },
    assessments: [{
      id: 1,
      status: 'expired'
    }]
  }
});
check('saved draft has first neutral review', () => assert.equal(selectPreparationAction(facts).primary.id, 'drafts'));
check('Forms next without draft', () => assert.equal(selectPreparationAction({
  ...facts,
  drafts: []
}).primary.id, 'forms'));
check('language review after saved work', () => assert.equal(selectPreparationAction({
  ...facts,
  drafts: [],
  saved: null
}).primary.id, 'language'));
check('documents after supported evidence', () => assert.equal(selectPreparationAction({
  ...facts,
  drafts: [],
  saved: null,
  languageState: 'unknown'
}).primary.id, 'documents'));
check('empty account gets source check not invented missing task', () => assert.equal(selectPreparationAction(normalize()).primary.id, 'resources'));
check('exactly one primary', () => assert.equal(Array.isArray(selectPreparationAction(facts).primary), false));
check('secondary bounded', () => assert.equal(selectPreparationAction(facts).secondary.length, 3));
check('no duplicate destinations', () => {
  const r = selectPreparationAction(facts);
  assert.equal(new Set([r.primary.path, ...r.secondary.map(t => t.path)]).size, 1 + r.secondary.length);
});
for (const id of ['forms', 'documents', 'language', 'resources']) check('user choice ' + id, () => assert.equal(selectPreparationAction(facts, id).primary.id, id));
check('removed task retained blocked', () => {
  const r = selectPreparationAction(normalize(), 'forms');
  assert.equal(r.primary.id, 'forms');
  assert.equal(r.primary.blocked, true);
  assert.equal(r.primary.reason, 'blocked');
});
check('choice cannot authorize anything', () => assert.equal('access' in selectPreparationAction(facts), false));
check('case-scoped Forms deep link', () => assert.equal(preparationTasks(facts).find(t => t.id === 'forms').path, '/forms?case_id=7'));
check('study handoff', () => assert.equal(selectPreparationAction({
  ...normalize(),
  caseType: 'study_permit'
}).primary.path, '/official-finders?tab=schools'));
check('deterministic repeated output', () => assert.deepEqual(selectPreparationAction(facts), selectPreparationAction(facts)));
check('inputs unchanged', () => {
  const before = JSON.stringify(facts);
  selectPreparationAction(facts, 'forms');
  assert.equal(JSON.stringify(facts), before);
});
for (const lang of ['en', 'fr']) check('copy keys for each reason ' + lang, () => {
  for (const task of preparationTasks(facts)) {
    assert.ok(premiumCopy[lang][task.label]);
    assert.ok(premiumCopy[lang][task.reason]);
  }
});
check('bilingual key parity', () => assert.deepEqual(Object.keys(premiumCopy.en).sort(), Object.keys(premiumCopy.fr).sort()));
const dashboard = await readFile(new URL('../src/pages/SelfDashboardPage.jsx', import.meta.url), 'utf8');
check('no workspace generation import', () => assert.equal(/runSelfWorkspace|saveSelfApplication|createCaseDraft|uploadSelfDocumentFile/.test(dashboard), false));
check('reject a foreign profile',()=>assert.throws(()=>normalize({profile:{user_id:11}})));
check('reject a malformed case title',()=>assert.throws(()=>normalize({context:{...base.context,case:{...base.context.case,case_title:{bad:true}}}})));
check('unavailable saved Forms stay unknown',()=>assert.equal(normalize().savedState,'unknown'));
check('explicit absent saved Forms remain distinct',()=>assert.equal(normalize({savedState:'absent'}).savedState,'absent'));
console.log(JSON.stringify({
  result: 'PASS',
  checks: count
}));
