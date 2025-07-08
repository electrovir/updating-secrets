import {type Item, type Client as OnePasswordClient} from '@1password/sdk';
import {assert} from '@augment-vir/assert';
import {
    arrayToObject,
    ensureError,
    mapObjectValuesSync,
    type SelectFrom,
} from '@augment-vir/common';
import {
    BaseSecretsAdapter,
    type ProcessedSecretDefinitions,
    type RawSecrets,
} from 'updating-secrets';
import {parseUrl} from 'url-vir';

/**
 * The necessary subset of the 1Password `Client` API that {@link OnePasswordAdapter} requires.
 *
 * @category Internal
 */
export type NeededOnePasswordClient = SelectFrom<
    OnePasswordClient,
    {
        items: {
            get: true;
        };
    }
>;

/**
 * Loads secrets from 1Password. A 1Password `Client` must be created and authorized before passing
 * it into here.
 *
 * @category Adapters
 */
export class OnePasswordAdapter extends BaseSecretsAdapter {
    constructor(protected readonly onePasswordClient: Readonly<NeededOnePasswordClient>) {
        super('OnePasswordAdapter');
    }

    /** Load secrets from the provided 1Password `Client`. */
    public override loadSecrets(secrets: ProcessedSecretDefinitions): RawSecrets {
        return mapObjectValuesSync(secrets, (secretName, secretDefinition) => {
            const onePasswordConfig = secretDefinition.adapterConfig.onePassword;

            if (!onePasswordConfig) {
                return new Error(
                    `No 1Password adapter config (required for using OnePasswordAdapter) defined for secret '${secretDefinition.secretName}'.`,
                );
            }
            const {itemId, vaultId} = extract1PasswordIds(onePasswordConfig.secretUrl);

            return this.onePasswordClient.items
                .get(vaultId, itemId)
                .then((item) => {
                    const fields = parseFields(item) satisfies Record<string, string>;

                    return fields;
                })
                .catch((error: unknown) => {
                    return ensureError(error);
                });
        });
    }
}

/**
 * Required 1Password `Item` for proper processing.
 *
 * @category Internal
 */
export type NeededOnePasswordItem = SelectFrom<
    Item,
    {
        fields: {
            id: true;
            value: true;
        };
    }
>;

/**
 * Extract the needed parameters for fetching an item from 1Password from an item URL.
 *
 * You can find the item URL by navigating to an item in 1Password, expanding the three dots menu,
 * and clicking "Copy Private Link".
 *
 * @category Internal
 */
export function extract1PasswordIds(url: string) {
    const {searchParams} = parseUrl(url);
    const itemId = searchParams.i?.[0];
    const vaultId = searchParams.v?.[0];

    assert.isTruthy(itemId, `Missing 1Password item id from url: ${url}`);
    assert.isTruthy(vaultId, `Missing 1Password vault id from url: ${url}`);

    return {
        itemId,
        vaultId,
    };
}

function parseFields(item: Readonly<NeededOnePasswordItem>): Record<string, string> {
    return arrayToObject(
        item.fields,
        (field) => {
            return {
                key: field.id,
                value: field.value,
            };
        },
        {
            useRequired: true,
        },
    );
}
