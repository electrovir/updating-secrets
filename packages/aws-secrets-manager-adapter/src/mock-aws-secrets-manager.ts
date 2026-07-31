import {assert} from '@augment-vir/assert';
import {type JsonCompatibleValue, type RequireExactlyOne} from '@augment-vir/common';
import {
    GetSecretValueCommand,
    type GetSecretValueCommandOutput,
} from '@aws-sdk/client-secrets-manager';

/**
 * Mock secrets setup for {@link MockAwsSecretsManagerClient}.
 *
 * @category Internal
 */
export type MockAwsSecrets = {
    [AwsSecretId in string]: RequireExactlyOne<{
        /**
         * A value that will be JSON stringified for the `.SecretString` output of AWS Secrets
         * Manager.
         */
        preJson: JsonCompatibleValue;
        /** Set the raw `.SecretString` output of AWS Secrets Manager directly. */
        rawString: string;
    }>;
};

/**
 * A mock implementation of `SecretsManagerClient` from the
 * [`@aws-sdk/client-secrets-manager`](https://www.npmjs.com/package/@aws-sdk/client-secrets-manager)
 * package.
 *
 * This only mocks the following:
 *
 * - The `.send()` method
 * - Sending a `GetSecretValueCommand` command
 * - Returning a `.SecretString` value from that command
 *
 * @category Mocks
 */
export class MockAwsSecretsManagerClient {
    constructor(protected readonly mockSecrets: MockAwsSecrets) {}

    /**
     * A mock implementation of `SecretsManagerClient.send()`. Only the first parameter (the
     * command) is used.
     */
    public send(command: GetSecretValueCommand): Promise<GetSecretValueCommandOutput> {
        if (!(command instanceof GetSecretValueCommand)) {
            throw new TypeError(
                `AWS Secrets Manager command not mocked: '${(command as any).constructor.name}'`,
            );
        }
        assert.isDefined(command.input.SecretId, 'No SecretId given.');

        const value = this.mockSecrets[command.input.SecretId];

        return Promise.resolve({
            SecretString: value
                ? value.preJson
                    ? JSON.stringify(value.preJson)
                    : value.rawString
                : undefined,
        } as GetSecretValueCommandOutput);
    }
}
