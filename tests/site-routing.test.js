import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('the entry page loads the redirect before the application', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const redirect = html.indexOf('src="site-routing.js"');
  assert.ok(redirect >= 0 && redirect < html.indexOf('src="app.js"'));
});

test('canonical routes never redirect and untrusted URL fields are discarded', async () => {
  const { legacySpellingRedirect: redirect } = await import('../site-routing.js');
  for (const href of ['https://boadillaschool.github.io/spelling/', 'https://boadillaschool.github.io/', 'https://boadillaschool.github.io/spelling-ea-ee-other/', 'not a URL', 'file:///spelling-ea-ee/']) {
    assert.equal(redirect(href), null, href);
  }
  for (const suffix of ['', '/', '/index.html']) {
    assert.equal(redirect(`https://boadillaschool.github.io/spelling-ea-ee${suffix}?list=2026-09-25&next=https://example.invalid/#private`), 'https://boadillaschool.github.io/spelling/?list=2026-09-25');
  }
  assert.equal(redirect('https://boadillaschool.github.io/spelling-ea-ee/?list=%3Cscript%3E#private'), 'https://boadillaschool.github.io/spelling/');
  assert.equal(redirect('http://127.0.0.1:1234/spelling-ea-ee/'), 'http://127.0.0.1:1234/spelling/');
});

// The old bookmarks must reach the canonical path without moving learner data.
test('legacy spelling links keep the dated lesson on the same origin', async () => {
  const { legacySpellingRedirect } = await import('../site-routing.js');
  assert.equal(
    legacySpellingRedirect('https://boadillaschool.github.io/spelling-ea-ee/?list=2026-10-02'),
    'https://boadillaschool.github.io/spelling/?list=2026-10-02'
  );
});
