import {assert} from '@augment-vir/assert';
import {
    combineErrors,
    DeferredPromise,
    ensureError,
    extractErrorMessage,
    getObjectTypedEntries,
    type JsonCompatibleValue,
    log,
    makeWritable,
    mapObject,
    mapObjectValues,
    mergeDefinedProperties,
    type PartialWithUndefined,
    type RequiredAndNotNull,
    type Values,
} from '@augment-vir/common';
import {type AnyDuration, convertDuration} from 'date-vir';
import {assertValidShape, defineShape} from 'object-shape-tester';
import {type BaseSecretsAdapter} from './adapters/base.adapter.js';
import {SecretLoadError} from './secret-load.error.js';
import {
    type ProcessedSecretDefinitions,
    rotatableSecretShape,
    type RotatableSecretValue,
    type SecretDefinitions,
    type SecretValues,
} from './secrets-definition/define-secrets.js';

/**
 * Options for {@link UpdatingSecrets} and {@link createUpdatingSecrets}.
 *
 * @category Internal
 */
export type UpdatingSecretsOptions = PartialWithUndefined<{
    /**
     * There are two ways to handle a secret load failure:
     *
     * 1. Fail immediately on initial load attempt. This will likely crash the whole app but provide
     *    immediate feedback.
     * 2. Fail only when the failed secret is accessed. This will likely not crash the whole app but
     *    will delay feedback on an misconfigured error.
     *
     * This property controls which of those failure methods will be used for this property:
     *
     * - `false` (default): failure option 1, fail immediately.
     * - `true`: failure option 2, fail only when accessed.
     *
     * This is extremely useful for dev or test environments where maybe some secrets won't actually
     * be populated or used. This should probably always be `false` in production to prevent
     * unexpected crashes down the line.
     *
     * @default false
     */
    lazyFailure: boolean;
    /**
     * The interval between each auto update. This duration will be clamped to 5 seconds as a
     * minimum.
     *
     * @default {minutes: 10}
     */
    updateInterval: AnyDuration;

    /**
     * Turn off all logging. This is not recommended as this only has minimal logging anyway.
     *
     * @default false
     */
    silent: boolean;

    /**
     * The number of consecutive secret load errors allowed before automatic updates are turned off.
     * This does not affect the _initial_ loading of secrets, which, upon failure, behaves according
     * to the `lazyFailure` option.
     *
     * @default 5
     */
    maxConsecutiveErrorCount: number;
}>;

const defaultOptions: RequiredAndNotNull<UpdatingSecretsOptions> = {
    lazyFailure: false,
    updateInterval: {
        minutes: 10,
    },
    silent: false,
    maxConsecutiveErrorCount: 5,
};

function finalizeOptions(
    userOptions: Readonly<UpdatingSecretsOptions>,
): RequiredAndNotNull<UpdatingSecretsOptions> {
    return mergeDefinedProperties(defaultOptions, userOptions);
}

/**
 * An all-in-one async function that constructs an instance of {@link UpdatingSecrets} and
 * initializes its secret values by calling and waiting for {@link UpdatingSecrets.loadSecrets}.
 *
 * @category UpdatingSecrets
 */
export async function createUpdatingSecrets<const Secrets extends Readonly<SecretDefinitions>>(
    secrets: Readonly<Secrets>,
    /**
     * A list of adapters to load secrets from. Order here matters: all values loaded from the last
     * adapters will override the previous values. Meaning, the first adapter can be used as a
     * "default" value source while all subsequent adapters will override its values.
     */
    adapters: ReadonlyArray<Readonly<BaseSecretsAdapter>>,
    options: Readonly<UpdatingSecretsOptions> = {},
) {
    const updatingSecrets = new UpdatingSecrets<Secrets>(secrets, adapters, options);
    /** Trigger the first load so that secrets are initialized. */
    await updatingSecrets.loadSecrets();
    return updatingSecrets;
}

/**
 * This class:
 *
 * - Loads all secrets from all given adapters and consolidates the values
 * - Automatically reloads all secrets on an interval
 * - Aborts automatic reloads after a customizable number of consecutive failures
 * - Provides access to all the latest secret values with the {@link UpdatingSecrets.get} property
 *
 * Make sure to call and await {@link UpdatingSecrets.loadSecrets} at least once before using
 * {@link UpdatingSecrets.get} for the first time. Alternatively, consider using
 * {@link createUpdatingSecrets} which handles that async setup automatically.
 *
 * @category UpdatingSecrets
 */
export class UpdatingSecrets<const Secrets extends Readonly<SecretDefinitions>> {
    protected readonly processedSecrets: ProcessedSecretDefinitions;
    protected currentSecrets: SecretValues<Secrets> | undefined;
    protected readonly options: RequiredAndNotNull<UpdatingSecretsOptions>;
    protected nextUpdateTimeout: undefined | ReturnType<typeof globalThis.setTimeout>;
    public readonly isDestroyed: boolean = false;
    /**
     * Keeps track of the last triggered {@link UpdatingSecrets.loadSecrets} call to prevent multiple
     * calls of it from overlapping: only one can be running at a time.
     */
    protected loadingSecretsPromise: Promise<SecretValues<Secrets>> | undefined;
    protected consecutiveFailureCount = 0;

    constructor(
        secrets: Readonly<Secrets>,
        /**
         * A list of adapters to load secrets from. Order here matters: all values loaded from the
         * last adapters will override the previous values. Meaning, the first adapter can be used
         * as a "default" value source while all subsequent adapters will override its values.
         */
        protected readonly adapters: ReadonlyArray<Readonly<BaseSecretsAdapter>>,
        options: Readonly<UpdatingSecretsOptions> = {},
    ) {
        if (!adapters.length) {
            throw new Error('No adapters to read secrets from.');
        }

        this.options = finalizeOptions(options);
        this.processedSecrets = processSecrets(secrets);
    }

    /** Stop the auto updating and destroy all adapters. */
    public destroy() {
        if (this.isDestroyed) {
            return;
        }
        makeWritable(this).isDestroyed = true;
        globalThis.clearTimeout(this.nextUpdateTimeout);
        this.loadingSecretsPromise = undefined;
        this.adapters.forEach((adapter) => adapter.destroy());
    }

    /** Runs the automatic secret updating timeout. */
    protected runAutoSecretUpdate() {
        this.nextUpdateTimeout = globalThis.setTimeout(
            async () => {
                /* node:coverage ignore next 3: this is only possible to trigger by unreliably getting this interval to trigger at the same time as the `.destroy()` method. This is simply here as a last ditch attempt to prevent any race conditions there. */
                if (this.isDestroyed) {
                    return;
                }

                log.if(!this.options.silent).info('Updating secrets.');
                try {
                    await this.loadSecrets();
                    this.consecutiveFailureCount = 0;
                } catch (error) {
                    log.if(!this.options.silent).error(error);
                    this.consecutiveFailureCount++;
                    if (
                        !this.currentSecrets ||
                        this.consecutiveFailureCount >= this.options.maxConsecutiveErrorCount
                    ) {
                        this.destroy();
                    }
                } finally {
                    this.runAutoSecretUpdate();
                }
            },
            Math.max(
                convertDuration(this.options.updateInterval, {
                    milliseconds: true,
                }).milliseconds,
                5000,
            ),
        );
    }

    /**
     * Loads all secrets and populates or updates {@link UpdatingSecrets.get}. This must be called
     * and awaited at least once before {@link UpdatingSecrets.get} can work, otherwise
     * {@link UpdatingSecrets.get} will error out. Consider using {@link createUpdatingSecrets},
     * instead of constructing {@link UpdatingSecrets} directly, which automatically handles calling
     * this for the first time.
     *
     * Only one secret update can be active at a time, so calling this multiple times in quick
     * succession will simply return the same promise of the latest-running update.
     */
    public async loadSecrets() {
        if (this.isDestroyed) {
            throw new Error(`Cannot load secrets for destroyed ${UpdatingSecrets.name} instance.`);
        } else if (this.loadingSecretsPromise) {
            return this.loadingSecretsPromise;
        }

        const deferredSecretsPromise = new DeferredPromise<SecretValues<Secrets>>();
        try {
            this.loadingSecretsPromise = deferredSecretsPromise.promise;

            const newSecrets: Record<string, SecretLoadError | JsonCompatibleValue> = {};

            const failedSecrets: Record<string, Error[]> = mapObjectValues(
                this.processedSecrets,
                (secretName, secretDefinition) => {
                    return [
                        new Error(
                            `No value for secret '${secretName}' was loaded. Find the value for this secret with the following instructions:\n${secretDefinition.help.whereToFind}`,
                        ),
                    ];
                },
            );

            const allResolvedRawSecrets: Record<string, JsonCompatibleValue | SecretLoadError>[] =
                await Promise.all(
                    this.adapters.map(
                        async (
                            adapter,
                        ): Promise<Record<string, JsonCompatibleValue | SecretLoadError>> => {
                            try {
                                const rawSecrets = await adapter.loadSecrets(this.processedSecrets);
                                return mapObjectValues(
                                    rawSecrets,
                                    async (
                                        secretName,
                                        loadedSecretValue,
                                    ): Promise<JsonCompatibleValue | SecretLoadError> => {
                                        try {
                                            const value = await loadedSecretValue;
                                            if (value instanceof Error) {
                                                throw value;
                                            } else if (
                                                this.processedSecrets[secretName]?.shapeDefinition
                                            ) {
                                                assertValidShape(
                                                    value,
                                                    this.processedSecrets[secretName]
                                                        .shapeDefinition,
                                                    /** Allow extra keys for forwards compatibility. */
                                                    {
                                                        allowExtraKeys: true,
                                                    },
                                                );
                                            }

                                            return value;
                                        } catch (caught) {
                                            const error = new SecretLoadError(ensureError(caught), {
                                                adapterName: adapter.adapterName,
                                                secretName,
                                            });
                                            return error;
                                        }
                                    },
                                );
                            } catch (error) {
                                log.if(!this.options.silent).warning(
                                    `Failed to load secrets for adapter '${adapter.adapterName}': ${extractErrorMessage(error)}`,
                                );
                                return {};
                            }
                        },
                    ),
                );

            allResolvedRawSecrets.forEach((rawSecrets) => {
                getObjectTypedEntries(rawSecrets).forEach(
                    ([
                        secretName,
                        secretValue,
                    ]) => {
                        if (secretValue instanceof SecretLoadError) {
                            if (newSecrets[secretName] instanceof SecretLoadError) {
                                newSecrets[secretName].allErrors.push(secretValue);
                            } else {
                                newSecrets[secretName] = secretValue;
                            }
                            failedSecrets[secretName] = newSecrets[secretName].allErrors;
                        } else {
                            delete failedSecrets[secretName];
                            newSecrets[secretName] = secretValue;
                        }
                    },
                );
            });
            const finalSecrets = {
                ...newSecrets,
            };

            const allErrors = Object.values(failedSecrets).flat();

            if (allErrors.length) {
                if (this.options.lazyFailure) {
                    getObjectTypedEntries(failedSecrets).forEach(
                        ([
                            secretName,
                            errors,
                        ]) => {
                            if (errors.length) {
                                Object.defineProperty(finalSecrets, secretName, {
                                    get() {
                                        throw combineErrors(errors);
                                    },
                                });
                            }
                        },
                    );
                } else {
                    throw combineErrors(allErrors);
                }
            }

            this.currentSecrets = finalSecrets as SecretValues<Secrets>;
            deferredSecretsPromise.resolve(this.currentSecrets);
            if (this.nextUpdateTimeout == undefined) {
                this.runAutoSecretUpdate();
            }
            return this.currentSecrets;
        } catch (error) {
            deferredSecretsPromise.reject(error);
            return deferredSecretsPromise.promise;
        } finally {
            this.loadingSecretsPromise = undefined;
        }
    }

    /**
     * Compare a value `underComparison` to a secret's currently known secret value that was defined
     * with {@link rotatableSecretShape}.
     *
     * @example
     *
     * ```ts
     * import {
     *     createUpdatingSecrets,
     *     rotatableSecretShape,
     *     defineSecrets,
     *     StaticSecretsAdapter,
     * } from 'updating-secrets';
     *
     * const updatingSecrets = await createUpdatingSecrets(
     *     defineSecrets({
     *         apiKey: {
     *             description: '',
     *             whereToFind: '',
     *             shape: rotatableSecretShape,
     *         },
     *     }),
     *     [
     *         new StaticSecretsAdapter({
     *             apiKey: {
     *                 current: 'latest key',
     *                 legacy: 'old key',
     *             },
     *         }),
     *     ],
     * );
     *
     * export async function handleApiRequest(request: Request) {
     *     const apiKey = request.headers.get('apiKey');
     *     if (!apiKey) {
     *         throw new Error('API request missing the required API key.');
     *     } else if (
     *         !updatingSecrets.compareRotatableSecret(apiKey, updatingSecrets.get.apiKey)
     *     ) {
     *         throw new Error('Invalid API key.');
     *     }
     * }
     * ```
     */
    public compareRotatableSecret(
        /**
         * The uncontrolled string to compare to your secrets.
         *
         * This could be, for example, an API key used by someone else trying to authenticate with
         * your service.
         */
        underComparison: string,
        /** The current value of the secret as obtained by {@link UpdatingSecrets.get}. */
        actualRotatableSecretValue: RotatableSecretValue,
    ) {
        if (underComparison === actualRotatableSecretValue.current) {
            return true;
        } else if (actualRotatableSecretValue.legacy == undefined) {
            return false;
        } else {
            return actualRotatableSecretValue.legacy === underComparison;
        }
    }

    /** Get the latest secret values. */
    public get get() {
        if (!this.currentSecrets) {
            throw new Error('Secrets not ready yet.');
        }

        return this.currentSecrets;
    }
}

/**
 * Processes the given {@link SecretDefinitions} so they can be easily consumed by adapters. This is
 * used within {@link UpdatingSecrets}. Outside of {@link UpdatingSecrets}, this is only useful for
 * testing adapters.
 *
 * @category Internal
 */
export function processSecrets<const Secrets extends SecretDefinitions>(
    secrets: Readonly<Secrets>,
) {
    return mapObject(secrets, (secretName, secretInit) => {
        assert.isString(secretName, `Invalid secret name '${String(secretName)}'`);
        const secretDefinition: Values<ProcessedSecretDefinitions> = {
            adapterConfig: secretInit.adapterConfig || {},
            help: {
                description: secretInit.description,
                whereToFind: secretInit.whereToFind,
            },
            secretName,
            shapeDefinition: secretInit.shape ? defineShape(secretInit.shape, true) : undefined,
        };
        return {
            key: secretName,
            value: secretDefinition,
        };
    });
}
