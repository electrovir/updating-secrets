import type {RequireExactlyOne} from 'type-fest';

/**
 * Mock data for {@link createMockReadFile}. There are two possible options contained herein, but
 * only one may be used at a time.
 *
 * @category Internal
 */
export type ReadFileMocks = RequireExactlyOne<{
    /**
     * This option specifies multiple files that can be read from the mocked `readFile` output of
     * {@link createMockReadFile}. The keys of this object must _exactly_ match the file paths passed
     * to the mock `readFile` output of {@link createMockReadFile}.
     */
    paths: {[FilePath in string]: string | Buffer};
    /** This option specifies the exact same output for any file path. */
    contents: string | Buffer;
}>;

/**
 * Mocks the built-in Node.js `fs.promises.readFile` method. See {@link ReadFileMocks} for details on
 * mocking strategies.
 *
 * @category Mocks
 */
export function createMockReadFile(
    mock: ReadFileMocks,
): (path: string) => Promise<string | Buffer> {
    return (filePath): Promise<string | Buffer> => {
        if ('contents' in mock) {
            return Promise.resolve(mock.contents);
        }
        const contents = mock.paths[filePath];

        if (contents == undefined) {
            const err = new Error(
                `ENOENT: no such file or directory, open '${filePath}'`,
            ) as NodeJS.ErrnoException;
            err.code = 'ENOENT';
            err.errno = -2;
            err.syscall = 'open';
            err.path = filePath;
            throw err;
        } else {
            return Promise.resolve(contents);
        }
    };
}
