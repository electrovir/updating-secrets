import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {StaticSecretsAdapter} from './static-secrets.adapter.js';

describe(StaticSecretsAdapter.name, () => {
    it('returns the given secrets', () => {
        const mockSecrets = {
            hello: 'there',
            key: 'value',
        };
        const adapter = new StaticSecretsAdapter(mockSecrets);
        assert.deepEquals(adapter.loadSecrets(), mockSecrets);
    });
});
