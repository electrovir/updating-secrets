import {type PartialWithUndefined, type Values} from '@augment-vir/common';
import {defineShape, optional, type ShapeDefinition} from 'object-shape-tester';
import {type Exact, type RequireExactlyOne} from 'type-fest';

/**
 * The shape definition for built-in handling of secret rotation. Use this shape in a secret
 * definition's `shape` property (when using {@link defineSecrets}).
 *
 * @category Define Secrets
 * @example
 *
 * - Use as the whole secret `shape`:
 *
 * ```ts
 * import {defineSecrets, rotatableSecretShape} from 'updating-secrets';
 *
 * defineSecrets({
 *     mySecret: {
 *         description: '',
 *         whereToFind: '',
 *         shape: rotatableSecretShape,
 *     },
 * });
 * ```
 *
 * - Use as a nested secret `shape`:
 *
 * ```ts
 * import {defineSecrets, rotatableSecretShape} from 'updating-secrets';
 *
 * defineSecrets({
 *     mySecret: {
 *         description: '',
 *         whereToFind: '',
 *         shape: {
 *             a: rotatableSecretShape,
 *             b: '',
 *         },
 *     },
 * });
 * ```
 */
export const rotatableSecretShape = defineShape({
    /** The latest up-to-date version of the secret's value. */
    current: '',
    /** The optional legacy value for the secret. Use for graceful secret rotation. */
    legacy: optional(''),
});

/**
 * Type expansion for {@link rotatableSecretShape}.
 *
 * @category Internal
 */
export type RotatableSecretValue = typeof rotatableSecretShape.runtimeType;

/**
 * The root of all secret options using `UpdatingSecrets`. This type defines the base secret
 * definitions type which should be extended by calling {@link defineSecrets}.
 *
 * @category Internal
 */
export type SecretDefinitions = {
    [SecretName in string]: {
        /** A description of what this secrets means, does, or is used for. */
        description: string;
        /**
         * A description of where someone can find the current value of this secret (such as how to
         * navigate a third party service to find the API key that they've provided to you).
         */
        whereToFind: string;

        adapterConfig?: PartialWithUndefined<{
            infisical: {
                projectId: string;
                folderPath?: string;
            } & RequireExactlyOne<{
                /**
                 * The name of the secret key within the given folder path. Use this when this
                 * secret definition corresponds exactly to a single secret entry in Infisical.
                 */
                keyInFolder: string;
                /**
                 * Set this to `true` to use the entire folder's contents as this secret's value.
                 * The folder will be loaded recursively, meaning all folders within this folder
                 * will also be loaded.
                 */
                useWholeFolder: true;
            }>;
            onePassword: {
                /** A URL generated from 1Password's "copy private link" action. */
                secretUrl: string;
            };
            /**
             * Configuration for loading this secret from AWS. This is required if you're using the
             * AWS SecretsManager adapter, otherwise the secret will fail to load.
             */
            aws: RequireExactlyOne<{
                /**
                 * The name of the AWS Secrets Manager secret that this secret's name is a key
                 * within.
                 *
                 * Set this config if this secret is a JSON property inside of an AWS Secrets
                 * Manager secret. Set the top level name of the AWS Secrets Manager secret here.
                 *
                 * @example
                 *
                 * - This secret's name is `sentryApiKey`.
                 * - You have a secret named `staging/BackendSecrets` in AWS Secrets Manager.
                 * - Within the JSON object for `staging/BackendSecrets` on AWS Secrets Manager,
                 *   there's a property called `sentryApiKey`.
                 * - Set this config (`keyIn`) to `staging/BackendSecrets`.
                 */
                keyIn: string;
                /**
                 * The name of the AWS Secrets Manager secret that this secret's entire definition
                 * comes from.
                 *
                 * Set this config if a AWS Secrets Manager secret's contents comprise this entire
                 * secret. Set the top level name of the AWS Secrets Manager secret here.
                 *
                 * @example
                 *
                 * - This secret's name is `database`.
                 * - You have a secret named `staging/DatabaseCredentials` in AWS Secrets Manager.
                 * - The entire contents of the `staging/DatabaseCredentials` secret on AWS Secrets
                 *   Manager should be the contents of this secret.
                 * - Set this config (`rootOf`) to `staging/DatabaseCredentials`.
                 */
                rootOf: string;
            }>;
        }>;

        shape?: unknown;
    };
};

/**
 * Defines and configures all secrets expected to be loaded by `UpdatingSecrets`.
 *
 * @category Define Secrets
 */
export function defineSecrets<
    const Secrets extends {
        [Key in keyof Secrets]: Exact<Values<SecretDefinitions>, Secrets[Key]>;
    } & SecretDefinitions,
>(secrets: Secrets): Secrets {
    return secrets;
}

/**
 * Processed secret definitions. This is what will be passed to all adapter `loadSecrets` methods.
 * This type is simply a more uniform and generic version of {@link SecretDefinitions}.
 *
 * @category Internal
 */
export type ProcessedSecretDefinitions = {
    [SecretName in string]: {
        secretName: SecretName;
        help: {
            description: string;
            whereToFind: string;
        };
        shapeDefinition: ShapeDefinition<unknown, true> | undefined;
        adapterConfig: NonNullable<Values<SecretDefinitions>['adapterConfig']>;
    };
};

/**
 * Maps a set of {@link SecretDefinitions} to the runtime values for those secrets.
 *
 * @category Internal
 */
export type SecretValues<Secrets extends SecretDefinitions = SecretDefinitions> = {
    [SecretName in keyof Secrets]: 'shape' extends keyof Secrets[SecretName]
        ? ShapeDefinition<Secrets[SecretName]['shape'], true>['runtimeType']
        : string;
};
