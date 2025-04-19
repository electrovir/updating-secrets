import {SecretsManager} from '@aws-sdk/client-secrets-manager';
import {AwsSecretsManagerAdapter, createUpdatingSecrets} from '../index.js';
import {mySecrets} from './define-secrets.example.js';

const updatingSecrets = await createUpdatingSecrets(mySecrets, [
    new AwsSecretsManagerAdapter(
        new SecretsManager({
            region: 'us-east-1',
        }),
    ),
]);
