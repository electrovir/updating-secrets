import {describe, it} from '@augment-vir/test';

describe('index', () => {
    it('can be imported without issue', async () => {
        await import('./index.js');
    });
});
