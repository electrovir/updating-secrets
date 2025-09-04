import {assert, waitUntil} from '@augment-vir/assert';
import {wait, type MaybePromise} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {BaseSecretsAdapter, type RawSecrets} from './adapters/base.adapter.js';
import {StaticSecretsAdapter} from './adapters/static-secrets.adapter.js';
import {
    defineSecrets,
    rotatableSecretShape,
    type ProcessedSecretDefinitions,
} from './secrets-definition/define-secrets.js';
import {createUpdatingSecrets, UpdatingSecrets} from './updating-secrets.js';

describe(UpdatingSecrets.name, () => {
    it('updates secrets', async () => {
        const secrets = {
            secret: '1',
        };
        const adapter = new StaticSecretsAdapter(secrets);
        const updatingSecrets = await createUpdatingSecrets(
            defineSecrets({
                secret: {
                    description: '',
                    whereToFind: '',
                },
            }),
            [adapter],
            {
                updateInterval: {
                    seconds: 0,
                },
            },
        );
        try {
            assert.tsType(updatingSecrets.get).equals<{
                secret: string;
            }>();
            assert.deepEquals(updatingSecrets.get, secrets);
            secrets.secret = '2';
            await waitUntil.strictEquals('2', () => updatingSecrets.get.secret);
        } finally {
            updatingSecrets.destroy();
        }
    });
    it('fails immediately on invalid secrets', async () => {
        const updatingSecrets = new UpdatingSecrets(
            defineSecrets({
                secret: {
                    description: '',
                    whereToFind: '',
                },
            }),
            [
                new StaticSecretsAdapter({}),
            ],
            {
                updateInterval: {
                    seconds: 0,
                },
            },
        );
        try {
            await assert.throws(() => updatingSecrets.loadSecrets());
        } finally {
            updatingSecrets.destroy();
        }
    });
    it('can fail lazily on invalid secrets', async () => {
        const updatingSecrets = await createUpdatingSecrets(
            defineSecrets({
                secretMissing: {
                    description: '',
                    whereToFind: '',
                },
                secretValid: {
                    description: '',
                    whereToFind: '',
                },
                secretWrongShape: {
                    description: '',
                    whereToFind: '',
                    shape: {
                        key: '',
                    },
                },
            }),
            [
                new StaticSecretsAdapter({
                    secretValid: 'value',
                    secretWrongShape: 'wrong shape',
                }),
                new StaticSecretsAdapter({
                    secretValid: 'value',
                    secretWrongShape: 'wrong shape',
                }),
            ],
            {
                updateInterval: {
                    seconds: 0,
                },
                lazyFailure: true,
            },
        );
        try {
            assert.strictEquals(updatingSecrets.get.secretValid, 'value');
            assert.throws(() => updatingSecrets.get.secretMissing, {
                matchMessage: 'No value',
            });
            assert.throws(() => updatingSecrets.get.secretWrongShape, {
                matchMessage: 'Expected object',
            });
        } finally {
            updatingSecrets.destroy();
        }
    });
    it('handles failing adapter', async () => {
        const updatingSecrets = await createUpdatingSecrets(
            defineSecrets({
                secret: {
                    description: '',
                    whereToFind: '',
                },
            }),
            [
                new StaticSecretsAdapter({
                    get secret(): string {
                        throw new Error('stuff');
                    },
                }),
            ],
            {
                updateInterval: {
                    seconds: 0,
                },
                lazyFailure: true,
            },
        );
        try {
            assert.throws(() => updatingSecrets.get.secret, {
                matchMessage: 'No value',
            });
        } finally {
            updatingSecrets.destroy();
        }
    });
    it('handles long running adapters', async () => {
        let loadCount = 1;
        class LongRunningAdapter extends BaseSecretsAdapter {
            constructor() {
                super('LongRunningAdapter');
            }

            public override async loadSecrets(secrets: Readonly<ProcessedSecretDefinitions>) {
                loadCount++;
                await wait({seconds: 1});

                return {
                    secret: 'value',
                };
            }
        }

        const updatingSecrets = await createUpdatingSecrets(
            defineSecrets({
                secret: {
                    description: '',
                    whereToFind: '',
                },
            }),
            [
                new LongRunningAdapter(),
            ],
            {
                updateInterval: {
                    seconds: 0,
                },
                lazyFailure: true,
            },
        );
        void updatingSecrets.loadSecrets();
        void updatingSecrets.loadSecrets();
        try {
            await waitUntil.isAtLeast(2, () => loadCount);
        } finally {
            updatingSecrets.destroy();
        }
    });
    it('rejects an empty adapters list', () => {
        assert.throws(() => new UpdatingSecrets({}, []));
    });
    it('rejects loading secrets from a destroyed instance', async () => {
        const updatingSecrets = await createUpdatingSecrets(
            defineSecrets({
                secret: {
                    description: '',
                    whereToFind: '',
                },
            }),
            [
                new StaticSecretsAdapter({
                    secret: 'value',
                }),
            ],
            {
                updateInterval: {
                    seconds: 0,
                },
                lazyFailure: true,
            },
        );
        updatingSecrets.destroy();
        await assert.throws(() => updatingSecrets.loadSecrets());
    });
    it('can handle failed updates', async () => {
        let shouldFailNext = false;
        let failureCount = 0;
        let successCount = 0;
        class IntermittentFailingAdapter extends BaseSecretsAdapter {
            constructor() {
                super('IntermittentFailingAdapter');
            }

            public override loadSecrets(): MaybePromise<RawSecrets> {
                if (shouldFailNext) {
                    failureCount++;
                    shouldFailNext = false;
                    throw new Error('intentional failure');
                } else {
                    shouldFailNext = true;
                    successCount++;
                    return {
                        secret: 'value',
                    };
                }
            }
        }

        const updatingSecrets = await createUpdatingSecrets(
            defineSecrets({
                secret: {
                    description: '',
                    whereToFind: '',
                },
            }),
            [new IntermittentFailingAdapter()],
            {
                updateInterval: {
                    seconds: 0,
                },
            },
        );
        try {
            await waitUntil.isAtLeast(2, () => failureCount, {
                timeout: {
                    minutes: 5,
                },
            });
            await waitUntil.isAtLeast(2, () => successCount, {
                timeout: {
                    minutes: 5,
                },
            });
        } finally {
            updatingSecrets.destroy();
        }
    });
    it('destroys itself if there are too many failed updates', async () => {
        let successCount = 0;
        class FailingAdapter extends BaseSecretsAdapter {
            constructor() {
                super('IntermittentFailingAdapter');
            }

            public override loadSecrets(): MaybePromise<RawSecrets> {
                if (successCount > 3) {
                    throw new Error('intentional failure');
                } else {
                    successCount++;
                    return {
                        secret: 'value',
                    };
                }
            }
        }

        const updatingSecrets = await createUpdatingSecrets(
            defineSecrets({
                secret: {
                    description: '',
                    whereToFind: '',
                },
            }),
            [new FailingAdapter()],
            {
                updateInterval: {
                    seconds: 0,
                },
            },
        );
        try {
            await waitUntil.isTrue(() => updatingSecrets.isDestroyed, {
                timeout: {
                    minutes: 5,
                },
            });
        } finally {
            updatingSecrets.destroy();
        }
    });
    it('handles error secret value', async () => {
        await assert.throws(
            () =>
                createUpdatingSecrets(
                    defineSecrets({
                        secret: {
                            description: '',
                            whereToFind: '',
                        },
                    }),
                    [
                        new StaticSecretsAdapter({
                            secret: new Error('failed secret') as any,
                        }),
                    ],
                    {
                        updateInterval: {
                            seconds: 0,
                        },
                    },
                ),
            {
                matchMessage: 'failed secret',
            },
        );
    });
    it("errors when retrieving a secret if the haven't been loaded yet", () => {
        const secrets = {
            secret: '1',
        };
        const adapter = new StaticSecretsAdapter(secrets);
        const updatingSecrets = new UpdatingSecrets(
            defineSecrets({
                secret: {
                    description: '',
                    whereToFind: '',
                },
            }),
            [adapter],
            {
                updateInterval: {
                    seconds: 0,
                },
            },
        );
        try {
            assert.throws(() => updatingSecrets.get);
        } finally {
            updatingSecrets.destroy();
        }
    });
    it('compares a rotatable secret', async () => {
        const secrets = {
            secret: {
                current: '1',
                legacy: '0',
            },
            secretWithoutLegacy: {
                current: '2',
            },
        };
        const adapter = new StaticSecretsAdapter(secrets);
        const updatingSecrets = await createUpdatingSecrets(
            defineSecrets({
                secret: {
                    description: '',
                    whereToFind: '',
                    shape: rotatableSecretShape,
                },
                secretWithoutLegacy: {
                    description: '',
                    whereToFind: '',
                    shape: rotatableSecretShape,
                },
            }),
            [adapter],
            {
                updateInterval: {
                    seconds: 0,
                },
            },
        );
        try {
            assert.isTrue(updatingSecrets.compareRotatableSecret('0', updatingSecrets.get.secret));
            assert.isTrue(updatingSecrets.compareRotatableSecret('1', updatingSecrets.get.secret));
            assert.isTrue(
                updatingSecrets.compareRotatableSecret(
                    '2',
                    updatingSecrets.get.secretWithoutLegacy,
                ),
            );
            assert.isFalse(
                updatingSecrets.compareRotatableSecret(
                    '0',
                    updatingSecrets.get.secretWithoutLegacy,
                ),
            );
        } finally {
            updatingSecrets.destroy();
        }
    });
});
