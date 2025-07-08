import {assert} from '@augment-vir/assert';
import {
    ensureError,
    getOrSet,
    mapObjectValuesSync,
    parseWithJson5,
    wrapInTry,
    type AnyObject,
} from '@augment-vir/common';
import {
    type GetSecretValueCommand,
    type GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';
import {BaseSecretsAdapter, type ProcessedSecretDefinitions} from 'updating-secrets';

/**
 * Minimal subset of AWS's `SecretsManagerClient` from the
 * [`@aws-sdk/client-secrets-manager`](https://www.npmjs.com/package/@aws-sdk/client-secrets-manager)
 * package required for {@link AwsSecretsManagerAdapter}.
 *
 * For testing purposes use `MockAwsSecretsManagerClient` to create a mock instance of this.
 *
 * @category Internal
 */
export type NeededAwsSecretsManagerClient = {
    /**
     * Same as AWS's `SecretsManagerClient.send()` method but this only accepts the
     * `GetSecretValueCommand` command.
     */
    send(command: GetSecretValueCommand): Promise<GetSecretValueCommandOutput>;
};

/**
 * Loads secrets from AWS Secrets Manager. A `SecretsManagerClient` instance must be provided.
 *
 * @category Adapters
 */
export class AwsSecretsManagerAdapter extends BaseSecretsAdapter {
    constructor(protected readonly awsSecretsManager: Readonly<NeededAwsSecretsManagerClient>) {
        super('AwsSecretsManagerAdapter');
    }

    /** Loads secrets from the provided `SecretsManagerClient`. */
    public override async loadSecrets(secrets: ProcessedSecretDefinitions) {
        /* node:coverage ignore next 1: dynamic imports are not branches */
        const {GetSecretValueCommand} = await import('@aws-sdk/client-secrets-manager');

        const cachedSecrets: {[AwsSecretName in string]: Promise<unknown>} = {};

        return mapObjectValuesSync(secrets, (secretName, secretDefinition) => {
            const awsConfig = secretDefinition.adapterConfig.aws;
            if (!awsConfig) {
                return new Error(
                    `No AWS adapter config (required for using AwsSecretsManagerAdapter) defined for secret '${secretDefinition.secretName}'.`,
                );
            }

            const awsSecretName = awsConfig.keyIn || awsConfig.rootOf;
            if (!awsSecretName) {
                return new Error(
                    `Invalid AWS adapter key config for '${secretDefinition.secretName}'.`,
                );
            }
            const secretValue = getOrSet(cachedSecrets, awsSecretName, () => {
                const sendCommand = new GetSecretValueCommand({
                    SecretId: awsSecretName,
                });
                return this.awsSecretsManager.send(sendCommand).then((result) => {
                    try {
                        const secretValue = result.SecretString;

                        if (secretValue) {
                            return wrapInTry(() => parseWithJson5(secretValue), {
                                fallbackValue: secretValue,
                            });
                        } else {
                            throw new Error(
                                `AWS SecretsManager secret '${awsSecretName}' has no string value.`,
                            );
                        }
                    } catch (error) {
                        return ensureError(error);
                    }
                });
            });

            return secretValue
                .then((awsSecretValue) => {
                    if (awsSecretValue instanceof Error) {
                        throw awsSecretValue;
                    } else if (awsConfig.keyIn) {
                        assert.isObject(
                            awsSecretValue,
                            `AWS secret at '${awsSecretName}' is not an object.`,
                        );

                        return (awsSecretValue as AnyObject)[secretDefinition.secretName];
                    } else if (secretDefinition.shapeDefinition) {
                        return wrapInTry(() => parseWithJson5(awsSecretValue as string), {
                            fallbackValue: awsSecretValue,
                        });
                    } else {
                        return awsSecretValue;
                    }
                })
                .catch((reason: unknown) => ensureError(reason));
        });
    }
}
