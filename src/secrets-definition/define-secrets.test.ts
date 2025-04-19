import {assert} from '@augment-vir/assert';
import {describe, it} from '@augment-vir/test';
import {defineSecrets, rotatableSecretShape, type SecretValues} from './define-secrets.js';

describe(defineSecrets.name, () => {
    it('preserves types', () => {
        const mySecrets = defineSecrets({
            mySecret1: {
                description: '',
                whereToFind: '',
                shape: {
                    a: rotatableSecretShape,
                    b: rotatableSecretShape,
                },
            },
            mySecret2: {
                description: '',
                whereToFind: '',
                shape: rotatableSecretShape,
            },
            mySecret3: {
                description: '',
                whereToFind: '',
            },
        });

        type MySecretsValues = SecretValues<typeof mySecrets>;

        assert.tsType<MySecretsValues>().equals<
            Readonly<{
                mySecret1: Readonly<{
                    a: Readonly<{
                        current: string;
                        legacy?: string;
                    }>;
                    b: Readonly<{
                        current: string;
                        legacy?: string;
                    }>;
                }>;
                mySecret2: Readonly<{
                    current: string;
                    legacy?: string;
                }>;
                mySecret3: string;
            }>
        >();
    });
});
