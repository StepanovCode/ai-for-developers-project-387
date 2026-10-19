import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Evaluator, Lexer, Parser, data } from '@actions/expressions';
import { load } from 'js-yaml';

const repository = 'StepanovCode/ai-for-developers-project-387';
const human = { type: 'User', login: 'maintainer' };
const workflows = Object.fromEntries(
  ['opencode', 'opencode-triage', 'opencode-review', 'opencode-audit'].map((name) => [
    name, load(readFileSync(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8')),
  ]),
);

// Evaluate the checked-in expressions with GitHub's implementation, not a copy
// of the policy. This does not simulate tokens, secrets or a hosted runner.
function accepts(name, eventName, event) {
  const workflow = workflows[name];
  const trigger = workflow.on[eventName];
  if (!Object.hasOwn(workflow.on, eventName)) return false;
  if (trigger?.types && !trigger.types.includes(event.action)) return false;
  const jobs = Object.values(workflow.jobs);
  assert.equal(jobs.length, 1, 'Add explicit policy coverage for every agent job');
  const [job] = jobs;
  if (!job.if) return true;
  const { tokens } = new Lexer(job.if).lex();
  const expression = new Parser(tokens, ['github'], []).parse();
  const context = JSON.parse(JSON.stringify({
    github: { repository, event_name: eventName, event },
  }), data.reviver);
  const result = new Evaluator(expression, context).evaluate();
  assert.equal(result.kind, data.Kind.Boolean);
  return result.value;
}

function comment(body, association = 'OWNER', sender = human) {
  return { action: 'created', sender, comment: { body, author_association: association } };
}

function pullRequest(sender = human) {
  return {
    action: 'opened', sender, repository: { private: false },
    pull_request: { user: human, head: { repo: { full_name: repository } } },
  };
}

for (const eventName of ['issue_comment', 'pull_request_review_comment']) {
  test(`${eventName}: ordinary comments and edits do not call the agent`, () => {
    assert.equal(accepts('opencode', eventName, comment('Спасибо за разбор')), false);
    assert.equal(accepts('opencode', eventName, { ...comment('/oc explain'), action: 'edited' }), false);
  });
  test(`${eventName}: both explicit commands work for trusted participants`, () => {
    for (const role of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
      for (const command of ['/oc', '/opencode', '/OPENCODE']) {
        assert.equal(accepts('opencode', eventName, comment(`${command} explain`, role)), true);
      }
    }
  });
  test(`${eventName}: external authors cannot invoke the agent`, () => {
    for (const role of ['NONE', 'CONTRIBUTOR', 'FIRST_TIMER', 'FIRST_TIME_CONTRIBUTOR']) {
      assert.equal(accepts('opencode', eventName, comment('/oc explain', role)), false);
    }
  });
}

for (const login of ['opencode-agent[bot]', 'github-actions[bot]', 'dependabot[bot]']) {
  const bot = { type: 'Bot', login };
  test(`${login}: commands in replies cannot cause a loop`, () => {
    for (const eventName of ['issue_comment', 'pull_request_review_comment']) {
      assert.equal(accepts('opencode', eventName, comment('/oc /opencode', 'OWNER', bot)), false);
    }
  });
  test(`${login}: issues do not start triage`, () => {
    assert.equal(accepts('opencode-triage', 'issues', {
      action: 'opened', sender: bot, issue: { author_association: 'OWNER' },
    }), false);
  });
  test(`${login}: PR events do not start review`, () => {
    for (const action of ['opened', 'synchronize', 'reopened', 'ready_for_review']) {
      assert.equal(accepts('opencode-review', 'pull_request', { ...pullRequest(bot), action }), false);
    }
  });
  test(`${login}: workflow_dispatch cannot start an audit`, () => {
    assert.equal(accepts('opencode-audit', 'workflow_dispatch', { sender: bot }), false);
  });
}

test('triage accepts new issues from trusted humans, without a command', () => {
  for (const role of ['OWNER', 'MEMBER', 'COLLABORATOR']) {
    assert.equal(accepts('opencode-triage', 'issues', {
      action: 'opened', sender: human, issue: { author_association: role },
    }), true);
  }
});

test('triage ignores external issues and repeated issue events', () => {
  assert.equal(accepts('opencode-triage', 'issues', {
    action: 'opened', sender: human, issue: { author_association: 'NONE' },
  }), false);
  for (const action of ['edited', 'reopened']) {
    assert.equal(accepts('opencode-triage', 'issues', {
      action, sender: human, issue: { author_association: 'OWNER' },
    }), false);
  }
});

test('review accepts a normal human-authored PR', () => {
  assert.equal(accepts('opencode-review', 'pull_request', pullRequest()), true);
});

test('release-please using the owner PAT is accepted as a User event', () => {
  const event = pullRequest({ type: 'User', login: 'StepanovCode' });
  event.pull_request.user = event.sender;
  event.pull_request.head.ref = 'release-please--branches--main--components--ai-for-developers-project-387';
  assert.equal(accepts('opencode-review', 'pull_request', event), true);
});

test('a human updating an app-authored PR can start review', () => {
  for (const action of ['opened', 'synchronize', 'reopened', 'ready_for_review']) {
    const event = pullRequest();
    event.action = action;
    event.pull_request.user = { type: 'Bot', login: 'opencode-agent[bot]' };
    assert.equal(accepts('opencode-review', 'pull_request', event), true);
  }
});

test('review still excludes fork PRs and private repositories', () => {
  const fork = pullRequest();
  fork.pull_request.head.repo.full_name = 'outside/fork';
  assert.equal(accepts('opencode-review', 'pull_request', fork), false);
  const privateRepo = pullRequest();
  privateRepo.repository.private = true;
  assert.equal(accepts('opencode-review', 'pull_request', privateRepo), false);
});

test('the scheduled audit does not require a sender in its payload', () => {
  assert.equal(accepts('opencode-audit', 'schedule', { schedule: '17 3 * * *' }), true);
});

test('a human can manually start the audit', () => {
  assert.equal(accepts('opencode-audit', 'workflow_dispatch', { sender: human }), true);
});

test('an unidentified sender cannot manually start the audit', () => {
  assert.equal(accepts('opencode-audit', 'workflow_dispatch', {}), false);
});
