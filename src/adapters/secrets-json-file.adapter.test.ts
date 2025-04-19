import {assert} from '@augment-vir/assert';
import {stringifyWithJson5} from '@augment-vir/common';
import {describe, it} from '@augment-vir/test';
import {createMockReadFile} from '../public-mocks/mock-read-file.js';
import {mockJsonFilePath} from '../repo-paths.mock.js';
import {SecretsJsonFileAdapter} from './secrets-json-file.adapter.js';

describe(SecretsJsonFileAdapter.name, () => {
    it('reads a normal JSON file', async () => {
        const mockContents = {fake: 'contents'};

        const instance = new SecretsJsonFileAdapter(
            'my path',
            createMockReadFile({contents: JSON.stringify(mockContents)}),
        );

        assert.deepEquals(await instance.loadSecrets(), mockContents);
    });
    it('reads a JSON5 file', async () => {
        const mockContents = {fake: 'contents'};

        const instance = new SecretsJsonFileAdapter(
            'my path',
            createMockReadFile({paths: {['my path']: stringifyWithJson5(mockContents)}}),
        );

        assert.deepEquals(await instance.loadSecrets(), mockContents);
    });
    it('errors on a missing file', async () => {
        const instance = new SecretsJsonFileAdapter('my path', createMockReadFile({paths: {}}));

        await assert.throws(() => instance.loadSecrets());
    });
    it('reads an actual file on the file system', async () => {
        const instance = new SecretsJsonFileAdapter(mockJsonFilePath);

        assert.deepEquals(await instance.loadSecrets(), {
            some: 'content',
        });
    });
});
