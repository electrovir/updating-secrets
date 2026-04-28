import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {createMockFs} from './mock-fs.js';

describe(createMockFs.name, () => {
    it('errors on missing file', async () => {
        const fs = createMockFs({
            paths: {},
        });
        await assert.throws(() => fs.promises.readFile('path'));
    });
});
