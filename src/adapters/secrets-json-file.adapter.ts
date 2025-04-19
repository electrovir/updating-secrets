import {parseWithJson5} from '@augment-vir/common';
import {readFile as readFileImport} from 'node:fs/promises';
import {BaseSecretsAdapter} from './base.adapter.js';

/**
 * Loads all secrets from a single JSON file. This should rarely be used in production environments.
 * Make sure that your secrets JSON file is not committed to your source code.
 *
 * This will not error out if any secrets are missing, but since `UpdatingSecrets` itself will, it's
 * recommended to set the `lazyFailure` option on `UpdatingSecrets` when using this adapter (or use
 * other adapters as well).
 *
 * @category Adapters
 */
export class SecretsJsonFileAdapter extends BaseSecretsAdapter {
    constructor(
        /** Path to the JSON */
        protected readonly jsonFilePath: string,
        /** Optional override for `fs.promises.readFile` for mocking, testing, or other purposes. */
        protected readonly readFileOverride: (
            filePath: string,
        ) => Promise<string | Buffer> = readFileImport,
    ) {
        super('SecretsJsonFileAdapter');
    }

    /** Loads secrets from the given JSON file path. */
    public override async loadSecrets() {
        const fileContents = String(await this.readFileOverride(this.jsonFilePath));

        return parseWithJson5(fileContents);
    }
}
