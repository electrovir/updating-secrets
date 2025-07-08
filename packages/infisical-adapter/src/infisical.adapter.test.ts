import {assert} from '@augment-vir/assert';
import {mapObjectValues} from '@augment-vir/common';
import {describe, it, itCases} from '@augment-vir/test';
import {InfisicalSDK} from '@infisical/sdk';
import {defineShape} from 'object-shape-tester';
import {defineSecrets, processSecrets, type SecretDefinitions} from 'updating-secrets';
import {
    getNested,
    InfisicalAdapter,
    setNested,
    type NeededInfisicalSdk,
} from './infisical.adapter.js';
import {MockInfisicalSdk, type MockInfisicalSecrets} from './mock-infisical-sdk.js';

describe('NeededInfisicalSdk', () => {
    it('is compatible with a real instance', () => {
        const sdk: NeededInfisicalSdk = new InfisicalSDK();
    });
});

describe(InfisicalAdapter.name, () => {
    async function testInfisicalAdapter(
        mockSecrets: Readonly<MockInfisicalSecrets>,
        env: string,
        secretDefinitions: SecretDefinitions,
    ) {
        const infisicalClient = await new MockInfisicalSdk(mockSecrets).auth().universalAuth.login({
            clientId: '',
            clientSecret: '',
        });
        const adapter = new InfisicalAdapter(infisicalClient, env);

        return await mapObjectValues(
            adapter.loadSecrets(processSecrets(secretDefinitions)),
            (key, value) => value,
        );
    }

    itCases(testInfisicalAdapter, [
        {
            it: 'loads easy secrets',
            inputs: [
                [
                    {
                        projectId: 'someProject',
                        env: 'dev',
                        secrets: {
                            innerSecret: {
                                folderPath: '/test-folder',
                                rawString: 'ffffffffffff',
                            },
                            test2: {
                                preJson: {
                                    has: 'json',
                                },
                            },
                            test: {
                                rawString: 'test',
                                folderPath: '/',
                            },
                            aaaaaaaa: {
                                folderPath: '/test-folder/nested-test-folder',
                                rawString: 'bbbbbbb',
                            },
                            stringified: {
                                preJson: {
                                    one: 'a',
                                    two: 'b',
                                },
                            },
                        },
                    },
                ],
                'dev',
                defineSecrets({
                    a: {
                        description: '',
                        whereToFind: '',
                        adapterConfig: {
                            infisical: {
                                projectId: 'someProject',
                                keyInFolder: 'test',
                            },
                        },
                    },
                    ab: {
                        description: '',
                        whereToFind: '',
                        adapterConfig: {
                            infisical: {
                                projectId: 'someProject',
                                keyInFolder: 'test2',
                            },
                        },
                    },
                    c: {
                        description: '',
                        whereToFind: '',
                        adapterConfig: {
                            infisical: {
                                projectId: 'someProject',
                                folderPath: 'test-folder',
                                useWholeFolder: true,
                            },
                        },
                    },
                    d: {
                        description: '',
                        whereToFind: '',
                        shape: defineShape({
                            one: '',
                            two: '',
                        }),
                        adapterConfig: {
                            infisical: {
                                projectId: 'someProject',
                                keyInFolder: 'stringified',
                            },
                        },
                    },
                }),
            ],
            expect: {
                a: 'test',
                ab: "{has:'json'}",
                c: {
                    innerSecret: 'ffffffffffff',
                    'nested-test-folder': {aaaaaaaa: 'bbbbbbb'},
                },
                d: {
                    one: 'a',
                    two: 'b',
                },
            },
        },
    ]);

    it('returns errors for failed secrets', async () => {
        const processedSecrets = defineSecrets({
            wrongProject: {
                description: '',
                whereToFind: '',
                adapterConfig: {
                    infisical: {
                        projectId: 'b',
                        useWholeFolder: true,
                    },
                },
            },
            keyInNonFolder: {
                description: '',
                whereToFind: '',
                adapterConfig: {
                    infisical: {
                        projectId: 'c',
                        folderPath: 'nonFolder',
                        keyInFolder: 'someKey',
                    },
                },
            },
            missingKey: {
                description: '',
                whereToFind: '',
                adapterConfig: {
                    infisical: {
                        projectId: 'c',
                        keyInFolder: 'missingKey',
                    },
                },
            },
            missingConfig: {
                description: '',
                whereToFind: '',
            },
        });

        const secrets = await testInfisicalAdapter(
            [
                {
                    env: 'dev',
                    projectId: 'a',
                    secrets: {},
                },
                {
                    env: 'dev',
                    projectId: 'c',
                    secrets: {
                        nonFolder: {
                            rawString: 'value',
                        },
                    },
                },
            ],
            'dev',
            processedSecrets,
        );
        assert.hasKeys(secrets, Object.keys(processedSecrets));
        Object.values(secrets).forEach((value) => {
            assert.instanceOf(value, Error);
        });
    });
});

describe(getNested.name, () => {
    itCases(getNested, [
        {
            it: 'fails on empty keys',
            inputs: [
                {},
                [],
            ],
            throws: {
                matchConstructor: Error,
            },
        },
        {
            it: 'fails on empty child',
            inputs: [
                {},
                ['a'],
            ],
            throws: {
                matchConstructor: Error,
            },
        },
        {
            it: 'fails if intermediate child is not an object',
            inputs: [
                {
                    a: 'done',
                },
                [
                    'a',
                    'b',
                    'c',
                ],
            ],
            throws: {
                matchConstructor: Error,
            },
        },
        {
            it: 'throws an error child',
            inputs: [
                {a: new Error('failed child')},
                ['a'],
            ],
            throws: {
                matchConstructor: Error,
                matchMessage: 'failed child',
            },
        },
        {
            it: 'gets a top level value',
            inputs: [
                {a: 'value'},
                ['a'],
            ],
            expect: 'value',
        },
        {
            it: 'gets a nested value',
            inputs: [
                {
                    a: {
                        b: {
                            c: 'value',
                        },
                    },
                },
                [
                    'a',
                    'b',
                    'c',
                ],
            ],
            expect: 'value',
        },
    ]);
});

describe(setNested.name, () => {
    function testSetNested(...args: Parameters<typeof setNested>) {
        setNested(...args);

        return args[0];
    }

    itCases(testSetNested, [
        {
            it: 'fails on empty keys',
            inputs: [
                {},
                [],
                'value',
            ],
            throws: {
                matchConstructor: Error,
            },
        },
        {
            it: 'sets a top level value',
            inputs: [
                {},
                ['a'],
                'value',
            ],
            expect: {
                a: 'value',
            },
        },
        {
            it: 'sets a nested value',
            inputs: [
                {},
                [
                    'a',
                    'b',
                    'c',
                ],
                'value',
            ],
            expect: {
                a: {
                    b: {
                        c: 'value',
                    },
                },
            },
        },
        {
            it: 'fails if an intermediate value already exists',
            inputs: [
                {
                    a: {
                        b: 'value',
                    },
                },
                [
                    'a',
                    'b',
                    'c',
                ],
                'value',
            ],
            throws: {
                matchConstructor: Error,
            },
        },
        {
            it: 'fails if an intermediate value is an error',
            inputs: [
                {
                    a: {
                        b: new Error(),
                    },
                },
                [
                    'a',
                    'b',
                    'c',
                ],
                'value',
            ],
            throws: {
                matchConstructor: Error,
            },
        },
        {
            it: 'sets a value even if intermediate objects already exist',
            inputs: [
                {
                    a: {
                        b: {},
                    },
                },
                [
                    'a',
                    'b',
                    'c',
                ],
                'value',
            ],
            expect: {
                a: {
                    b: {
                        c: 'value',
                    },
                },
            },
        },
    ]);
});
