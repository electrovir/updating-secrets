import {assert} from '@augment-vir/assert';
import {stringifyWithJson5} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {createMockFs} from '../public-mocks/mock-fs.js';
import {mockJsonFilePath} from '../repo-paths.mock.js';
import {SecretsJsonFileAdapter} from './secrets-json-file.adapter.js';

describe(SecretsJsonFileAdapter.name, () => {
    it('reads a normal JSON file', async () => {
        const mockContents = {fake: 'contents'};

        const instance = new SecretsJsonFileAdapter('my path', {
            fsOverride: createMockFs({contents: JSON.stringify(mockContents)}),
        });

        assert.deepEquals(await instance.loadSecrets(), mockContents);
    });
    it('reads a JSON5 file', async () => {
        const mockContents = {fake: 'contents'};

        const instance = new SecretsJsonFileAdapter('my path', {
            fsOverride: createMockFs({paths: {['my path']: stringifyWithJson5(mockContents)}}),
        });

        assert.deepEquals(await instance.loadSecrets(), mockContents);
    });
    it('errors on a missing file', async () => {
        const instance = new SecretsJsonFileAdapter('my path', {
            fsOverride: createMockFs({paths: {}}),
        });

        await assert.throws(() => instance.loadSecrets());
    });
    it('reads an actual file on the file system', async () => {
        const instance = new SecretsJsonFileAdapter(mockJsonFilePath);

        assert.deepEquals(await instance.loadSecrets(), {
            some: 'content',
        });
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

        assert.deepEquals(await instance.loadSecrets(), mockNewSecrets);
        assert.strictEquals(writtenContents, JSON.stringify(mockNewSecrets));
    });
});
