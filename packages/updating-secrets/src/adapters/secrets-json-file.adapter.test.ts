import {assert} from '@augment-vir/assert';
import {stringifyWithJson5} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {defineShape} from 'object-shape-tester';
import {createMockFs} from '../public-mocks/mock-fs.js';
import {mockJsonFilePath} from '../repo-paths.mock.js';
import {type ProcessedSecretDefinitions} from '../secrets-definition/define-secrets.js';
import {SecretsJsonFileAdapter} from './secrets-json-file.adapter.js';

function createMockSecretDefinitions(keys: string[]): ProcessedSecretDefinitions {
    const definitions: ProcessedSecretDefinitions = {};
    for (const key of keys) {
        definitions[key] = {
            secretName: key,
            help: {
                description: '',
                whereToFind: '',
            },
            shapeDefinition: undefined,
            adapterConfig: {},
        };
    }
    return definitions;
}

describe(SecretsJsonFileAdapter.name, () => {
    it('reads a normal JSON file', async () => {
        const mockContents = {
            fake: 'contents',
        };

        const instance = new SecretsJsonFileAdapter('my path', {
            fsOverride: createMockFs({
                contents: JSON.stringify(mockContents),
            }),
        });

        assert.deepEquals(
            await instance.loadSecrets(createMockSecretDefinitions(['fake'])),
            mockContents,
        );
    });
    it('reads a JSON5 file', async () => {
        const mockContents = {
            fake: 'contents',
        };

        const instance = new SecretsJsonFileAdapter('my path', {
            fsOverride: createMockFs({
                paths: {
                    ['my path']: stringifyWithJson5(mockContents),
                },
            }),
        });

        assert.deepEquals(
            await instance.loadSecrets(createMockSecretDefinitions(['fake'])),
            mockContents,
        );
    });
    it('errors on a missing file', async () => {
        const instance = new SecretsJsonFileAdapter('my path', {
            fsOverride: createMockFs({
                paths: {},
            }),
        });

        await assert.throws(() => instance.loadSecrets(createMockSecretDefinitions(['fake'])));
    });
    it('reads an actual file on the file system', async () => {
        const instance = new SecretsJsonFileAdapter(mockJsonFilePath);

        assert.deepEquals(await instance.loadSecrets(createMockSecretDefinitions(['some'])), {
            some: 'content',
        });
    });
    it('loads a single secret', async () => {
        const instance = new SecretsJsonFileAdapter(mockJsonFilePath);

        assert.strictEquals(await instance.loadSingleSecret('some'), 'content');
    });
    it('can generate new secrets', async () => {
        const mockNewSecrets = {
            new: 'secrets',
        };
        let writtenContents: string = '';

        const instance = new SecretsJsonFileAdapter('my path', {
            fsOverride: createMockFs(
                {
                    paths: {},
                },
                (filePath, contents) => {
                    assert.isString(contents);
                    writtenContents = contents;
                },
            ),
            generateValues() {
                return mockNewSecrets;
            },
        });

        assert.deepEquals(
            await instance.loadSecrets(createMockSecretDefinitions(['new'])),
            mockNewSecrets,
        );
        assert.strictEquals(writtenContents, JSON.stringify(mockNewSecrets));
    });
    it('generates only missing secrets when file exists', async () => {
        const existingSecrets = {
            existing: 'value',
        };
        const generatedSecrets = {
            existing: 'should-not-overwrite',
            newSecret: 'generated-value',
        };
        let writtenContents: string = '';
        let generateValuesCalled = false;

        const instance = new SecretsJsonFileAdapter('my path', {
            fsOverride: createMockFs(
                {
                    paths: {
                        ['my path']: JSON.stringify(existingSecrets),
                    },
                },
                (filePath, contents) => {
                    assert.isString(contents);
                    writtenContents = contents;
                },
            ),
            generateValues() {
                generateValuesCalled = true;
                return generatedSecrets;
            },
        });

        const result = await instance.loadSecrets(
            createMockSecretDefinitions([
                'existing',
                'newSecret',
            ]),
        );

        assert.isTrue(generateValuesCalled);
        assert.deepEquals(result, {
            existing: 'value',
            newSecret: 'generated-value',
        });
        assert.deepEquals(JSON.parse(writtenContents), {
            existing: 'value',
            newSecret: 'generated-value',
        });
    });
    it('does not call generateValues when no secrets are missing', async () => {
        const existingSecrets = {
            existing: 'value',
        };
        let generateValuesCalled = false;

        const instance = new SecretsJsonFileAdapter('my path', {
            fsOverride: createMockFs({
                paths: {
                    ['my path']: JSON.stringify(existingSecrets),
                },
            }),
            generateValues() {
                generateValuesCalled = true;
                return existingSecrets;
            },
        });

        const result = await instance.loadSecrets(createMockSecretDefinitions(['existing']));

        assert.deepEquals(result, existingSecrets);
        assert.isFalse(generateValuesCalled);
    });
    it('regenerates invalid secrets based on shapeDefinition', async () => {
        const existingSecrets = {
            validKey: {
                name: 'correct',
            },
            invalidKey: 'wrong-type',
        };
        const generatedSecrets = {
            validKey: {
                name: 'should-not-overwrite',
            },
            invalidKey: {
                name: 'regenerated',
            },
        };
        let writtenContents: string = '';
        let generateValuesCalled = false;

        const validShape = defineShape({
            name: '',
        });

        const secretDefinitions: ProcessedSecretDefinitions = {
            validKey: {
                secretName: 'validKey',
                help: {
                    description: '',
                    whereToFind: '',
                },
                shapeDefinition: validShape,
                adapterConfig: {},
            },
            invalidKey: {
                secretName: 'invalidKey',
                help: {
                    description: '',
                    whereToFind: '',
                },
                shapeDefinition: validShape,
                adapterConfig: {},
            },
        };

        const instance = new SecretsJsonFileAdapter('my path', {
            fsOverride: createMockFs(
                {
                    paths: {
                        ['my path']: JSON.stringify(existingSecrets),
                    },
                },
                (filePath, contents) => {
                    assert.isString(contents);
                    writtenContents = contents;
                },
            ),
            generateValues() {
                generateValuesCalled = true;
                return generatedSecrets;
            },
        });

        const result = await instance.loadSecrets(secretDefinitions);

        assert.isTrue(generateValuesCalled);
        assert.deepEquals(result, {
            validKey: {
                name: 'correct',
            },
            invalidKey: {
                name: 'regenerated',
            },
        });
        assert.deepEquals(JSON.parse(writtenContents), {
            validKey: {
                name: 'correct',
            },
            invalidKey: {
                name: 'regenerated',
            },
        });
    });
});
