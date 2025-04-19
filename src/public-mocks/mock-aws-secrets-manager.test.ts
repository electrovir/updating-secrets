import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {GetResourcePolicyCommand} from '@aws-sdk/client-secrets-manager';
import {AwsSecretsManagerAdapter} from '../adapters/aws-secrets-manager.adapter.js';
import {MockAwsSecretsManagerClient} from './mock-aws-secrets-manager.js';

describe(MockAwsSecretsManagerClient.name, () => {
    it('is compatible with the AWS Secrets Manager adapter', () => {
        // eslint-disable-next-line sonarjs/constructor-for-side-effects
        new AwsSecretsManagerAdapter(new MockAwsSecretsManagerClient({}));
    });
    it('does not support non-GetSecretValueCommand commands', async () => {
        const client = new MockAwsSecretsManagerClient({});
        await assert.throws(() =>
            client.send(new GetResourcePolicyCommand({SecretId: 'something'})),
        );
    });
});
