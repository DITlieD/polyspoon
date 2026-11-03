import test from 'node:test';
import assert from 'node:assert/strict';
import {displayTitle} from '../server/catalog-presentation.ts';

test('catalog display titles drop handle separators', () => {
 assert.equal(displayTitle('smithy--preset--base'), 'Smithy');
 assert.equal(displayTitle('porcini--porcini--base'), 'Porcini');
 assert.equal(displayTitle('fruit-stall--preset--base'), 'Fruit Stall');
 assert.equal(displayTitle('Fruit Stall Preset'), 'Fruit Stall');
 assert.equal(displayTitle('young-ember'), 'Young Ember');
 assert.equal(displayTitle('Garden bench 25'), 'Garden bench 25');
});
