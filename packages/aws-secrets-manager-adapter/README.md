# @updating-secrets/aws-secrets-manager-adapter

Adapter for [the `updating-secrets` package](https://www.npmjs.com/package/updating-secrets) for AWS Secrets Manager.

<!-- example-link: src/aws-secrets.example.ts -->

```TypeScript
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
```
