import {assert} from '@augment-vir/assert';
import {
    awaitAllPromisesInObject,
    filterMap,
    getObjectTypedEntries,
    omitObjectKeys,
} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {MockAwsSecretsManagerClient} from '../public-mocks/mock-aws-secrets-manager.js';
import {mockSecrets, mockSecretValues} from '../secrets-definition/define-secrets.mock.js';
import {processSecrets} from '../updating-secrets.js';
import {AwsSecretsManagerAdapter} from './aws-secrets-manager.adapter.js';

describe(AwsSecretsManagerAdapter.name, () => {
    it('loads secrets', async () => {
        const adapter = new AwsSecretsManagerAdapter(
            new MockAwsSecretsManagerClient(mockSecretValues),
        );

        const loadedSecrets = await awaitAllPromisesInObject(
            await adapter.loadSecrets(processSecrets(mockSecrets)),
        );
        const erroredSecretNames = filterMap(
            getObjectTypedEntries(loadedSecrets),
            ([secretName]) => secretName,
            (
                secretName,
                [
                    ,
                    secretValue,
                ],
            ) => secretValue instanceof Error,
        );

        assert.deepEquals(
            erroredSecretNames.toSorted(),
            [
                'missingAwsConfig',
                'missingValue',
                'objectSecretInInvalidJson',
                'objectSecretInJson5',
                'missingAwsSecret',
                'invalidAwsConfig',
            ].sort(),
        );

        assert.deepEquals(omitObjectKeys(loadedSecrets, erroredSecretNames), {
            simpleSecret: 'simple secret value',
            objectSecret: {
                id: 'id here',
                secret: 'secret here',
            },
            invalidObjectSecretValue: {
                id: 'id here',
            },
            rotatableSecretWithLegacy: {
                current: 'current value',
                legacy: 'legacy value',
            },
            rotatableSecretWithoutLegacy: {
                current: 'current value',
            },
            rootAwsSecret: {
                clientId: 'client id',
                clientSecret: 'client secret',
                clientName: 'client name',
            },
            stringRoot: 'value here',
        } satisfies Partial<Record<keyof typeof mockSecrets, unknown>>);
        erroredSecretNames.forEach((secretName) => {
            assert.instanceOf(loadedSecrets[secretName], Error);
        });
    });
});
