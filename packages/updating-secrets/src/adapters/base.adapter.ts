import {type JsonCompatibleValue, type MaybePromise} from '@augment-vir/common';
import {type ProcessedSecretDefinitions} from '../secrets-definition/define-secrets.js';

/**
 * Raw secret values as returned by an adapter's `loadSecrets` method.
 *
 * @category Internal
 */
export type RawSecrets = {[SecretName in string]: MaybePromise<JsonCompatibleValue | Error>};

/**
 * This is the base secrets adapter class. This doesn't actually connect to anything. Only use it as
 * a base class for adapters that _do_ connect to something.
 *
 * @category Internal
 */
export class BaseSecretsAdapter {
    constructor(public readonly adapterName: string) {
        if (!adapterName) {
            throw new Error(`Cannot have empty adapter name in '${this.constructor.name}'.`);
        }
    }

    /**
     * Load secrets from the adapter. This base implementation should never be used and, thus,
     * simply throws an error. It is expected that this class will be extended by actual adapters
     * and this method will be overridden.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public loadSecrets(secrets: Readonly<ProcessedSecretDefinitions>): MaybePromise<RawSecrets> {
        throw new Error('Do not try to load secrets from the base secrets adapter.');
    }

    /**
     * Clean up all resources created by the adapter. This should not cause the adapter to destroy
     * any resources passed to it in its constructor.
     */
    public destroy() {}

    /** Load an individual secret from the adapter. No shape checking is performed here. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public loadSingleSecret(secretId: string): MaybePromise<unknown> {
        throw new Error('Do not try to load a secret from the base secrets adapter.');
    }
}
