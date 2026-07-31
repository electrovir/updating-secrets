import {type MaybePromise, type RequireExactlyOne} from '@augment-vir/common';
import {type SecretsJsonFileAdapterOptions} from '../adapters/secrets-json-file.adapter.js';

/**
 * Mock data for {@link createMockFs}. There are two possible options contained herein, but only one
 * may be used at a time.
 *
 * @category Internal
 */
export type FileMocks = RequireExactlyOne<{
    /**
     * This option specifies multiple files that can be read from the mocked `readFile` output of
     * {@link createMockFs}. The keys of this object must _exactly_ match the file paths passed to
     * the mock `readFile` output of {@link createMockFs}.
     */
    paths: {[FilePath in string]: string | Buffer};
    /** This option specifies the exact same output for any file path. */
    contents: string | Buffer;
}>;

/**
 * Mocks the built-in Node.js `fs.promises.readFile` method. See {@link FileMocks} for details on
 * mocking strategies.
 *
 * @category Mocks
 */
export function createMockFs(
    mockFiles: FileMocks,
    writeFileMockCallback?:
        | ((filePath: string, contents: string | Buffer) => MaybePromise<void>)
        | undefined,
): SecretsJsonFileAdapterOptions['fsOverride'] {
    const writtenFiles: Record<string, string | Buffer> = {};

    return {
        promises: {
            mkdir() {
                return Promise.resolve();
            },
            readFile(filePath) {
                if ('contents' in mockFiles) {
                    return Promise.resolve(mockFiles.contents);
                }
                const contents = {
                    ...mockFiles.paths,
                    ...writtenFiles,
                }[filePath];

                if (contents == undefined) {
                    const error = new Error(
                        `ENOENT: no such file or directory, open '${filePath}'`,
                    ) as NodeJS.ErrnoException;
                    error.code = 'ENOENT';
                    error.errno = -2;
                    error.syscall = 'open';
                    error.path = filePath;
                    throw error;
                } else {
                    return Promise.resolve(contents);
                }
            },
            async writeFile(filePath, contents) {
                if (writeFileMockCallback) {
                    await writeFileMockCallback(filePath, contents);
                }
                writtenFiles[filePath] = contents;
            },
        },
        existsSync(filePath) {
            if ('contents' in mockFiles) {
                return true;
            } else {
                return filePath in mockFiles.paths;
            }
        },
    };
}
