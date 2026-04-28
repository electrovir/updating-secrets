import {check} from '@augment-vir/assert';
import {
    ensureError,
    getOrSet,
    mapObjectValuesSync,
    parseWithJson5,
    removePrefix,
    removeSuffix,
    stringify,
    type Values,
    wrapInTry,
} from '@augment-vir/common';
import {type ListSecretsOptions, type Secret} from '@infisical/sdk';
import {
    BaseSecretsAdapter,
    type ProcessedSecretDefinitions,
    type RawSecrets,
} from 'updating-secrets';

/**
 * Intermediate type for processing secrets from Infisical. Used in {@link InfisicalAdapter} and
 * helper functions.
 *
 * @category Internal
 */
export type MappedInfisicalSecrets = {
    [SecretKey in string]: string | MappedInfisicalSecrets | Error;
};

/**
 * The necessary subset of the `InfisicalSDK` API that {@link InfisicalAdapter} requires.
 *
 * @category Internal
 */
export type NeededInfisicalSdk = {
    /** Get the Infisical secrets client. */
    secrets(): {
        /** List the Infisical secrets. */
        listSecrets(options: ListSecretsOptions): Promise<{secrets: NeededInfisicalSecret[]}>;
    };
};

/**
 * The necessary subset of the Infisical `Secret` type that {@link InfisicalAdapter} requires.
 *
 * @category Internal
 */
export type NeededInfisicalSecret = Pick<Secret, 'secretKey' | 'secretPath' | 'secretValue'>;

/**
 * Loads secrets from Infisical. A `InfisicalSDK` instance must be provided. The `InfisicalSDK`
 * instance must also be authorized _before_ passing it into this.
 *
 * @category Adapters
 */
export class InfisicalAdapter extends BaseSecretsAdapter {
    constructor(
        /**
         * Make sure that you've already authenticated this client.
         * (`client.auth().universalAuth.login()`)
         */
        protected readonly infisicalClient: Readonly<NeededInfisicalSdk>,
        /** `'dev'`, `'staging'`, `'prod'`, etc. */
        protected readonly infisicalEnvironment: string,
    ) {
        super('InfisicalAdapter');
    }

    /** Load secrets from the provided `InfisicalSDK`. */
    public override loadSecrets(secrets: ProcessedSecretDefinitions): RawSecrets {
        const secretsCache: {[ProjectId in string]: Promise<MappedInfisicalSecrets | Error>} = {};

        return mapObjectValuesSync(secrets, (secretName, secretDefinition) => {
            const infisicalConfig = secretDefinition.adapterConfig.infisical;

            if (!infisicalConfig) {
                return new Error(
                    `No Infisical adapter config (required for using InfisicalAdapter) defined for secret '${secretDefinition.secretName}'.`,
                );
            }

            const projectSecretsPromise = getOrSet(secretsCache, infisicalConfig.projectId, () => {
                return (
                    this.loadSingleSecret(infisicalConfig.projectId)
                        /* node:coverage ignore next 3 */
                        .catch((error: unknown) => {
                            return ensureError(error);
                        })
                );
            });

            return projectSecretsPromise
                .then((projectSecrets) => {
                    /* node:coverage ignore next 3 */
                    if (projectSecrets instanceof Error) {
                        return projectSecrets;
                    }

                    const folderValue =
                        infisicalConfig.folderPath === '/' || !infisicalConfig.folderPath
                            ? projectSecrets
                            : getNested(
                                  projectSecrets,
                                  removeSuffix({
                                      value: removePrefix({
                                          value: infisicalConfig.folderPath,
                                          prefix: '/',
                                      }),
                                      suffix: '/',
                                  }).split('/'),
                              );

                    /* node:coverage ignore next 3 */
                    if (check.isError(folderValue)) {
                        return folderValue;
                    }

                    if (infisicalConfig.keyInFolder) {
                        if (check.isString(folderValue)) {
                            throw new TypeError(`Cannot get keyInFolder of a non-folder.`);
                        } else if (check.hasKey(folderValue, infisicalConfig.keyInFolder)) {
                            const value = folderValue[infisicalConfig.keyInFolder];

                            if (secretDefinition.shapeDefinition && check.isString(value)) {
                                return wrapInTry(() => parseWithJson5(value), {
                                    fallbackValue: folderValue,
                                });
                            } else {
                                return value;
                            }
                        } else {
                            throw new Error(
                                `Secret key not in folder '${infisicalConfig.folderPath}'`,
                            );
                        }
                    } else {
                        return folderValue;
                    }
                })
                .catch((error: unknown) => {
                    return ensureError(error);
                });
        });
    }

    /** Load an entire project's secrets via `projectId`. */
    public override async loadSingleSecret(projectId: string) {
        const rawSecrets = await this.infisicalClient.secrets().listSecrets({
            recursive: true,
            environment: this.infisicalEnvironment,
            projectId,
            viewSecretValue: true,
        });
        return mapInfisicalSecrets(rawSecrets.secrets);
    }
}

function mapInfisicalSecrets(secrets: NeededInfisicalSecret[]): MappedInfisicalSecrets {
    const secretsMap: MappedInfisicalSecrets = {};

    secrets.forEach((secret) => {
        if (!secret.secretPath || secret.secretPath === '/') {
            secretsMap[secret.secretKey] = secret.secretValue;
        } else {
            setNested(
                secretsMap,
                removeSuffix({
                    value: removePrefix({
                        value: secret.secretPath,
                        prefix: '/',
                    }),
                    suffix: '/',
                })
                    .split('/')
                    .concat(secret.secretKey),
                secret.secretValue,
            );
        }
    });

    return secretsMap;
}

/**
 * Get an Infisical secret value nested within an object.
 *
 * @category Internal
 */
export function getNested(
    parent: MappedInfisicalSecrets,
    keys: string[],
): Values<MappedInfisicalSecrets> {
    const nextKey = keys[0];

    if (nextKey == undefined) {
        throw new Error('Invalid key or ran out of keys.');
    }

    const nextParent = parent[nextKey];

    if (!nextParent) {
        throw new Error(`Nothing at key '${nextKey}'`);
    } else if (nextParent instanceof Error) {
        throw nextParent;
    }

    if (keys.length > 1) {
        if (check.isString(nextParent)) {
            throw new TypeError(
                `Keys still remain but received string value: ${stringify({
                    keys,
                })}`,
            );
        }
        return getNested(nextParent, keys.slice(1));
    } else {
        return nextParent;
    }
}

/**
 * Set an Infisical secret value nested within an object.
 *
 * @category Internal
 */
export function setNested(parent: MappedInfisicalSecrets, keys: string[], value: string) {
    const nextKey = keys[0];

    if (nextKey == undefined) {
        throw new Error('Invalid key or ran out of keys.');
    } else if (keys.length === 1) {
        parent[nextKey] = value;
        return;
    }

    const nextParent = getOrSet(parent, nextKey, () => {
        return {};
    });

    if (check.isString(nextParent) || check.isError(nextParent)) {
        throw new TypeError(`Cannot set key '${nextKey}'; it's already set to a non-object.`);
    }

    return setNested(nextParent, keys.slice(1), value);
}
