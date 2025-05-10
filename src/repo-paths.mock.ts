import {join, resolve} from 'node:path';

export const repoDirPath = resolve(import.meta.dirname, '..');
export const testFilesDirPath = join(repoDirPath, 'test-files');
export const mockJsonFilePath = join(testFilesDirPath, 'test.json');
export const notCommittedDirPath = join(repoDirPath, '.not-committed');
