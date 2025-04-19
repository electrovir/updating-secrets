import {AwsSecretsManagerAdapter} from './aws-secrets-manager.adapter.js';
import {SecretsJsonFileAdapter} from './secrets-json-file.adapter.js';
import {StaticSecretsAdapter} from './static-secrets.adapter.js';

/**
 * All built-in secrets adapters.
 *
 * @category Internal
 */
export const allSecretAdapters = {
    AwsSecretsManagerAdapter,
    SecretsJsonFileAdapter,
    StaticSecretsAdapter,
};
