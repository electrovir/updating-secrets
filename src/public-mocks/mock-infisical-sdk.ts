import {
    getObjectTypedEntries,
    stringifyWithJson5,
    type AnyObject,
    type JsonCompatibleValue,
} from '@augment-vir/common';
import {type InfisicalSDK, type ListSecretsOptions, type Secret} from '@infisical/sdk';
import {type RequireExactlyOne} from 'type-fest';
import {MockAwsSecretsManagerClient} from './mock-aws-secrets-manager.js';

/**
 * Mock secrets setup for {@link MockAwsSecretsManagerClient}.
 *
 * @category Internal
 */
export type MockInfisicalSecrets = {
    projectId: string;
    /** `'dev'`, `'staging'`, `'prod'`, etc. */
    env: string;
    secrets: {
        [SecretKey in string]: {
            folderPath?: string | undefined;
        } & RequireExactlyOne<{
            /**
             * A value that will be JSON stringified for the `.SecretString` output of AWS Secrets
             * Manager.
             */
            preJson: JsonCompatibleValue;
            /** Set the raw `.SecretString` output of AWS Secrets Manager directly. */
            rawString: string;
        }>;
    };
}[];

/**
 * A mock implementation of `InfisicalSDK` from the
 * [@infisical/sdk](https://www.npmjs.com/package/@infisical/sdk) package. This only mocks what is
 * necessary for the infisical adapter to work.
 *
 * @category Mocks
 */
export class MockInfisicalSdk {
    /** Keeps track of whether this SDK has been authorized or not. */
    protected isAuthorized = false;

    constructor(
        /** Mock secrets that will be used in `secrets().listSecrets()` */
        public readonly mockSecrets: Readonly<MockInfisicalSecrets>,
    ) {}

    /** Mock of `InfisicalSDK.auth()` */
    public auth() {
        return {
            /** Mock of `InfisicalSDK.auth().universalAuth` */
            universalAuth: {
                /** Mock of `InfisicalSDK.auth().universalAuth.login()` */
                login: (
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    ...params: Parameters<
                        ReturnType<InfisicalSDK['auth']>['universalAuth']['login']
                    >
                ) => {
                    this.isAuthorized = true;
                    return Promise.resolve(
                        this satisfies MockInfisicalSdk as AnyObject as InfisicalSDK,
                    );
                },
                /** Mock of `InfisicalSDK.auth().universalAuth.renew()` */
                renew() {
                    throw new Error('Not mocked.');
                },
            },
            /** Mock of `InfisicalSDK.auth().accessToken` */
            accessToken: (
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                ...params: Parameters<ReturnType<InfisicalSDK['auth']>['accessToken']>
            ) => {
                this.isAuthorized = true;

                return this satisfies MockInfisicalSdk as AnyObject as InfisicalSDK;
            },
            /** Mock of `InfisicalSDK.auth().awsIamAuth` */
            awsIamAuth: {
                /** Mock of `InfisicalSDK.auth().awsIamAuth.login()` */
                login: (
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    ...params: Parameters<ReturnType<InfisicalSDK['auth']>['awsIamAuth']['login']>
                ) => {
                    this.isAuthorized = true;
                    return Promise.resolve(
                        this satisfies MockInfisicalSdk as AnyObject as InfisicalSDK,
                    );
                },
                /** Mock of `InfisicalSDK.auth().awsIamAuth.renew()` */
                renew() {
                    throw new Error('Not mocked.');
                },
            },
        } satisfies Partial<ReturnType<InfisicalSDK['auth']>>;
    }

    /** Mock of `InfisicalSDK.secrets()` */
    public secrets() {
        return {
            /** Mock of `InfisicalSDK.secrets().listSecrets()` */
            listSecrets: ({projectId, environment}: ListSecretsOptions) => {
                if (!this.isAuthorized) {
                    throw new Error('Mock Infisical SDK client not authorized.');
                }

                const secrets = this.mockSecrets.find(
                    (mock) => mock.projectId === projectId && mock.env === environment,
                )?.secrets;

                if (!secrets) {
                    throw new Error('Invalid project.');
                }

                return Promise.resolve({
                    secrets: getObjectTypedEntries(secrets).map(
                        ([
                            secretKey,
                            mockDefinition,
                        ]): Partial<Secret> => {
                            return {
                                secretPath: mockDefinition.folderPath || '/',
                                secretKey,
                                secretValue: mockDefinition.preJson
                                    ? stringifyWithJson5(mockDefinition.preJson)
                                    : mockDefinition.rawString || '',
                            };
                        },
                    ),
                });
            },
        };
    }
}
