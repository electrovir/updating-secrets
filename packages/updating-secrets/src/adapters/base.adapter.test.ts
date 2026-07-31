import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {BaseSecretsAdapter} from './base.adapter.js';

describe(BaseSecretsAdapter.name, () => {
    it('errors on base loadSecrets method', async () => {
        const adapter = new BaseSecretsAdapter('mock');
        await assert.throws(async () => await adapter.loadSecrets({}));
    });
    it('errors on base loadSingleSecret method', async () => {
        const adapter = new BaseSecretsAdapter('mock');
        await assert.throws(async () => await adapter.loadSingleSecret(''));
    });
    it('allows base destroy method', () => {
        const adapter = new BaseSecretsAdapter('mock');
        assert.doesNotThrow(() => adapter.destroy());
    });
    it('blocks empty names', () => {
        assert.throws(() => new BaseSecretsAdapter(''));
    });
});
