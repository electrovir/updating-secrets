import {type JsonCompatibleValue} from '@augment-vir/common';
import {BaseSecretsAdapter} from './base.adapter.js';

/**
 * This adapter is constructed with a static set of secrets and that static set of secrets is always
 * directly returned when loading secrets.
 *
 * This is primarily designed for the following use cases:
 *
 * - Providing default values for secrets, which are intended to be overridden in following adapters
 *   (in the adapters array given to an instance of `UpdatingSecrets`).
 * - Setting mock secret values for testing purposes.
 *
 * @category Adapters
 */
export class StaticSecretsAdapter extends BaseSecretsAdapter {
    constructor(
        /** Static secrets that will always be directly returned as the latest set of loaded secrets. */
        protected readonly staticSecrets: Record<string, JsonCompatibleValue>,
    ) {
        super('StaticSecretsAdapter');
    }

    /** Directly returns the static secrets given. */
    public override loadSecrets() {
        return this.staticSecrets;
    }

    /** Load an individual secret from the static secrets given. */
    public override loadSingleSecret(secretKey: string) {
        return this.staticSecrets[secretKey];
    }
}
