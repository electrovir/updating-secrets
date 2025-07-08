import {SecretsManager} from '@aws-sdk/client-secrets-manager';
import {createUpdatingSecrets} from 'updating-secrets';
import {mySecrets} from 'updating-secrets/src/examples/define-secrets.example.js';
import {AwsSecretsManagerAdapter} from './aws-secrets-manager.adapter.js';

const updatingSecrets = await createUpdatingSecrets(mySecrets, [
    new AwsSecretsManagerAdapter(
        new SecretsManager({
            region: 'us-east-1',
        }),
    ),
]);
