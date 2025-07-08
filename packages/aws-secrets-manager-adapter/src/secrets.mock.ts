import {stringifyWithJson5, type Values} from '@augment-vir/common';
import {defineSecrets, rotatableSecretShape} from 'updating-secrets';
import {type MockAwsSecrets} from './mock-aws-secrets-manager.js';

export const mockAwsSecretNames = {
    mockSecrets: 'mock/secrets',
    mockRootSecrets: 'mock/RootSecrets',
    mockStringRooSecret: 'mock/StringRoot',
    invalidJson: 'mock/InvalidJson',
    mockJson5Secrets: 'mock/Json5Secrets',
} as const;

export const mockSecrets = defineSecrets({
    simpleSecret: {
        description: 'just a string',
        whereToFind: 'here',
        adapterConfig: {
            aws: {
                keyIn: mockAwsSecretNames.mockSecrets,
            },
        },
    },
    invalidAwsConfig: {
        description: 'has aws config but it is wrong',
        whereToFind: 'here',
        adapterConfig: {
            // @ts-expect-error: intentionally incorrect for testing purposes
            aws: {},
        },
    },
    objectSecret: {
        description: 'has nested values',
        whereToFind: 'here',
        adapterConfig: {
            aws: {
                keyIn: mockAwsSecretNames.mockSecrets,
            },
        },
        shape: {
            id: '',
            secret: '',
        },
    },
    stringRoot: {
        description: "is a root config that's just a plain string",
        whereToFind: 'here',
        adapterConfig: {
            aws: {
                rootOf: mockAwsSecretNames.mockStringRooSecret,
            },
        },
    },
    invalidObjectSecretValue: {
        description: 'this secret has an invalid value in mocks',
        whereToFind: 'here',
        adapterConfig: {
            aws: {
                keyIn: mockAwsSecretNames.mockSecrets,
            },
        },
        shape: {
            id: '',
            secret: '',
        },
    },
    rotatableSecretWithLegacy: {
        description: 'is rotatable with legacy value',
        whereToFind: 'here',
        adapterConfig: {
            aws: {
                keyIn: mockAwsSecretNames.mockSecrets,
            },
        },
        shape: rotatableSecretShape,
    },
    rotatableSecretWithoutLegacy: {
        description: 'is rotatable without legacy value',
        whereToFind: 'here',
        adapterConfig: {
            aws: {
                keyIn: mockAwsSecretNames.mockSecrets,
            },
        },
        shape: rotatableSecretShape,
    },
    rootAwsSecret: {
        description: 'this secret is the whole root of an AWS Secrets Manager entry',
        whereToFind: 'here',
        adapterConfig: {
            aws: {
                rootOf: mockAwsSecretNames.mockRootSecrets,
            },
        },
        shape: {
            clientId: '',
            clientSecret: '',
            clientName: '',
        },
    },
    missingAwsConfig: {
        description: 'this is missing the aws adapter config',
        whereToFind: 'here',
    },
    missingValue: {
        description: "Don't provide a value for this secret in mocks.",
        whereToFind: 'here',
    },
    objectSecretInInvalidJson: {
        description: 'this is an object secret stored in an AWS secret with invalid JSON',
        whereToFind: 'here',
        adapterConfig: {
            aws: {
                keyIn: mockAwsSecretNames.invalidJson,
            },
        },
        shape: {
            firstName: '',
            lastName: '',
        },
    },
    missingAwsSecret: {
        description: 'this AWS secret does not exist',
        whereToFind: 'here',
        adapterConfig: {
            aws: {
                keyIn: 'mock/MissingSecret',
            },
        },
    },
    objectSecretInJson5: {
        description: 'this is an object secret stored in an AWS secret with JSON 5 format',
        whereToFind: 'here',
        adapterConfig: {
            aws: {
                keyIn: mockAwsSecretNames.invalidJson,
            },
        },
        shape: {
            firstName2: '',
            lastName2: '',
        },
    },
});

export const mockSecretValues: MockAwsSecrets = {
    [mockAwsSecretNames.mockSecrets]: {
        preJson: {
            simpleSecret: 'simple secret value',
            objectSecret: {
                id: 'id here',
                secret: 'secret here',
            },
            invalidObjectSecretValue: {
                id: 'id here',
                /** Missing `secret` key. */
            },
            missingAwsConfig: 'missing aws config value',
            rotatableSecretWithLegacy: {
                current: 'current value',
                legacy: 'legacy value',
            },
            rotatableSecretWithoutLegacy: {
                current: 'current value',
            },
        },
    },
    [mockAwsSecretNames.mockRootSecrets]: {
        preJson: {
            clientId: 'client id',
            clientSecret: 'client secret',
            clientName: 'client name',
        },
    },
    [mockAwsSecretNames.invalidJson]: {
        rawString: `objectSecretInInvalidJson: some value`,
    },
    [mockAwsSecretNames.mockJson5Secrets]: {
        rawString: stringifyWithJson5({
            mockJson5Secrets: {
                firstName2: 'first name 2',
                lastName2: 'last name 2',
            },
        }),
    },
    [mockAwsSecretNames.mockStringRooSecret]: {
        rawString: 'value here',
    },
} satisfies Record<Values<typeof mockAwsSecretNames>, Values<MockAwsSecrets>>;
