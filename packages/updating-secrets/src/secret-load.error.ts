import {extractErrorMessage} from '@augment-vir/common';

/**
 * An error encountered while trying to load a secret value.
 *
 * @category Internal
 */
export class SecretLoadError extends Error {
    public override readonly name = 'SecretLoadError';
    /**
     * All errors that were encountered while trying to load this secret. These may be from multiple
     * adapters.
     */
    public allErrors: Error[] = [];

    constructor(
        originalError: Error,
        {
            adapterName,
            secretName,
        }: {
            adapterName: string;
            secretName: string;
        },
    ) {
        const message = `Failed to load secret '${secretName}' from adapter '${adapterName}': ${extractErrorMessage(originalError)}`;

        super(message, {cause: originalError});
        this.allErrors.push(originalError);
    }
}
