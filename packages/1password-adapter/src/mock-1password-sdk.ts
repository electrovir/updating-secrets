import {type Item} from '@1password/sdk';
import {assert} from '@augment-vir/assert';
import {type AnyObject} from '@augment-vir/common';
import {type NeededOnePasswordClient, type NeededOnePasswordItem} from './1password.adapter.js';

/**
 * Mock secrets setup for {@link MockOnePasswordSdk}.
 *
 * @category Internal
 */
export type MockOnePasswordSecrets = {
    [VaultId in string]: {
        [ItemId in string]: Record<string, string>;
    };
};

/**
 * A mock implementation of `InfisicalSDK` from the
 * [@infisical/sdk](https://www.npmjs.com/package/@infisical/sdk) package. This only mocks what is
 * necessary for the infisical adapter to work.
 *
 * @category Mocks
 */
export class MockOnePasswordSdk implements NeededOnePasswordClient {
    constructor(protected readonly mockSecrets: MockOnePasswordSecrets) {}

    /** Mocks 1Password's `Client.items` API. */
    public readonly items = {
        /** Mocks 1Password's `Client.items.get` method. */
        get: async (vaultId: string, itemId: string): Promise<Item> => {
            const mockValue = this.mockSecrets[vaultId]?.[itemId];

            assert.isDefined(
                mockValue,
                `No mock 1Password secret found with vault ID '${vaultId}' and item id '${itemId}'`,
            );

            const item: NeededOnePasswordItem = {
                fields: Object.entries(mockValue).map(
                    ([
                        id,
                        value,
                    ]) => {
                        return {
                            id,
                            value,
                        };
                    },
                ),
            };

            return Promise.resolve(item as AnyObject as Item);
        },
    };
}
