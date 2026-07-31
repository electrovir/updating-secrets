import {type Client} from '@1password/sdk';
import {assert} from '@augment-vir/assert';
import {mapObjectValues} from '@augment-vir/common';
import {describe, it, itCases} from '@augment-vir/test';
import {defineSecrets, processSecrets, type SecretDefinitions} from 'updating-secrets';
import {
    extract1PasswordIds,
    OnePasswordAdapter,
    type NeededOnePasswordClient,
} from './1password.adapter.js';
import {MockOnePasswordSdk, type MockOnePasswordSecrets} from './mock-1password-sdk.js';

describe('NeededOnePasswordClient', () => {
    it('is compatible with a real instance', () => {
        assert.tsType<Client>().matches<NeededOnePasswordClient>();
    });
});

describe(extract1PasswordIds.name, () => {
    itCases(extract1PasswordIds, [
        {
            it: 'handles a url',
            input: 'https://start.1password.com/open/i?a=aaaaaaaaaa&v=bbbbbbbbbbbbb&i=ccccccccccccccc',
            expect: {
                itemId: 'ccccccccccccccc',
                vaultId: 'bbbbbbbbbbbbb',
            },
        },
        {
            it: 'handles a url with just params',
            input: '?v=bbbbbbbbbbbbb&i=aaaaaaaaaa',
            expect: {
                itemId: 'aaaaaaaaaa',
                vaultId: 'bbbbbbbbbbbbb',
            },
        },
        {
            it: 'rejects a missing vault id',
            input: 'https://start.1password.com/open/i?a=aaaaaaaaaa&i=aaaaaaaaaa',
            throws: {
                matchMessage: 'Missing 1Password vault id',
            },
        },
        {
            it: 'rejects a missing item id',
            input: 'https://start.1password.com/open/i?a=aaaaaaaaaa&v=bbbbbbbbbbbbb',
            throws: {
                matchMessage: 'Missing 1Password item id',
            },
        },
    ]);
});

describe(OnePasswordAdapter.name, () => {
    async function testOnePasswordAdapter(
        mockSecrets: Readonly<MockOnePasswordSecrets>,
        secretDefinitions: SecretDefinitions,
    ) {
        const onePasswordClient = new MockOnePasswordSdk(mockSecrets);
        const adapter = new OnePasswordAdapter(onePasswordClient);

        return await mapObjectValues(
            adapter.loadSecrets(processSecrets(secretDefinitions)),
            (key, value) => value,
        );
    }

    itCases(testOnePasswordAdapter, [
        {
            it: 'loads easy secrets',
            inputs: [
                {
                    vaultA: {
                        itemA1: {
                            username: 'username A1',
                            password: 'password A1',
                        },
                        itemA2: {
                            username: 'username A2',
                            password: 'password A2',
                        },
                    },
                    vaultB: {
                        itemB1: {
                            username: 'username B1',
                            password: 'password B1',
                        },
                        itemB2: {
                            username: 'username B2',
                            password: 'password B2',
                        },
                    },
                },
                defineSecrets({
                    a1: {
                        description: '',
                        whereToFind: '',
                        adapterConfig: {
                            onePassword: {
                                secretUrl:
                                    'https://start.1password.com/open/i?a=aaaaaaaaaa&v=vaultA&i=itemA1',
                            },
                        },
                    },
                    a2: {
                        description: '',
                        whereToFind: '',
                        adapterConfig: {
                            onePassword: {
                                secretUrl:
                                    'https://start.1password.com/open/i?a=aaaaaaaaaa&v=vaultA&i=itemA2',
                            },
                        },
                    },
                    b1: {
                        description: '',
                        whereToFind: '',
                        adapterConfig: {
                            onePassword: {
                                secretUrl:
                                    'https://start.1password.com/open/i?a=aaaaaaaaaa&v=vaultB&i=itemB1',
                            },
                        },
                    },
                    b2: {
                        description: '',
                        whereToFind: '',
                        adapterConfig: {
                            onePassword: {
                                secretUrl:
                                    'https://start.1password.com/open/i?a=aaaaaaaaaa&v=vaultB&i=itemB2',
                            },
                        },
                    },
                }),
            ],
            expect: {
                a1: {
                    username: 'username A1',
                    password: 'password A1',
                },
                a2: {
                    username: 'username A2',
                    password: 'password A2',
                },
                b1: {
                    username: 'username B1',
                    password: 'password B1',
                },
                b2: {
                    username: 'username B2',
                    password: 'password B2',
                },
            },
        },
    ]);

    it('returns errors for failed secrets', async () => {
        const processedSecrets = defineSecrets({
            missing: {
                description: '',
                whereToFind: '',
                adapterConfig: {
                    onePassword: {
                        secretUrl: 'https://start.1password.com/open/i?v=a&i=b',
                    },
                },
            },
            noConfig: {
                description: '',
                whereToFind: '',
            },
        });

        const secrets = await testOnePasswordAdapter({}, processedSecrets);
        assert.hasKeys(secrets, Object.keys(processedSecrets));
        Object.values(secrets).forEach((value) => {
            assert.instanceOf(value, Error);
        });
    });
});
