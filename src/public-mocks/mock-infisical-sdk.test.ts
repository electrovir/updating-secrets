import {assert} from '@augment-vir/assert';
import {type AnyObject, type ArrayElement} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {MockInfisicalSdk} from './mock-infisical-sdk.js';

describe(MockInfisicalSdk.name, () => {
    it('rejects an unauthorized query', async () => {
        await assert.throws(
            () =>
                new MockInfisicalSdk([]).secrets().listSecrets({
                    environment: '',
                    projectId: '',
                }),
            {
                matchMessage: 'not authorized',
            },
        );
    });
    it('handles all mock secret types', async () => {
        const sdk = await new MockInfisicalSdk([
            {
                env: '',
                projectId: '',
                secrets: {
                    json: {
                        preJson: {
                            a: 'b',
                        },
                    },
                    string: {
                        rawString: 'a',
                    },
                    empty: {
                        rawString: '',
                    },
                },
            },
        ])
            .auth()
            .universalAuth.login({
                clientId: '',
                clientSecret: '',
            });

        const secrets = (await sdk.secrets().listSecrets({environment: '', projectId: ''})).secrets;

        assert.deepEquals(secrets as Partial<ArrayElement<typeof secrets>>[], [
            {
                secretPath: '/',
                secretKey: 'json',
                secretValue: "{a:'b'}",
            },
            {
                secretPath: '/',
                secretKey: 'string',
                secretValue: 'a',
            },
            {
                secretPath: '/',
                secretKey: 'empty',
                secretValue: '',
            },
        ]);
    });
    it('fails to renew', () => {
        const sdk = new MockInfisicalSdk([]);

        assert.throws(() => sdk.auth().awsIamAuth.renew());
        assert.throws(() => sdk.auth().universalAuth.renew());
    });
    it('authorizes itself', async () => {
        assert.isTrue(
            (
                new MockInfisicalSdk([]).auth().accessToken('') as AnyObject as {
                    isAuthorized: boolean;
                }
            ).isAuthorized,
        );
        assert.isTrue(
            (
                (await new MockInfisicalSdk([]).auth().universalAuth.login({
                    clientId: '',
                    clientSecret: '',
                })) as AnyObject as {
                    isAuthorized: boolean;
                }
            ).isAuthorized,
        );
        assert.isTrue(
            (
                (await new MockInfisicalSdk([]).auth().awsIamAuth.login({
                    identityId: '',
                })) as AnyObject as {
                    isAuthorized: boolean;
                }
            ).isAuthorized,
        );
    });
});
