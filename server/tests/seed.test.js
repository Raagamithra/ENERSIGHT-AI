import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSeedData } from '../seed/index.js';

test('buildSeedData returns a populated operational seed for facilities, meters, and users', () => {
  const seed = buildSeedData();

  assert.ok(seed.organization.name);
  assert.ok(Array.isArray(seed.facilities) && seed.facilities.length >= 4);
  assert.ok(Array.isArray(seed.meters) && seed.meters.length >= 5);
  assert.ok(Array.isArray(seed.users) && seed.users.length >= 3);
  assert.ok(seed.users.every((user) => user.email && user.password));
});
