import {
    mergeDefinedProperties,
    parseWithJson5,
    type MaybePromise,
    type PartialWithUndefined,
} from '@augment-vir/common';
import {existsSync as existsSyncImport} from 'node:fs';
import {readFile as readFileImport, writeFile as writeFileImport} from 'node:fs/promises';
import type {SecretDefinitions, SecretValues} from '../secrets-definition/define-secrets.js';
import {BaseSecretsAdapter} from './base.adapter.js';

/**
 * Options for {@link SecretsJsonFileAdapter}.
 *
 * @category Internal
 */
export type SecretsJsonFileAdapterOptions<Secrets extends SecretDefinitions = any> = {
    /**
     * Optional override for Node.js's `fs` for mocking, testing, or other purposes.
     *
     * @default import * as fs from 'node:fs';
     */
    fsOverride: {
        /** `'node:fs/promises'` */
        promises: {
            /** `readFile` from `'node:fs/promises'` */
            readFile: (filePath: string) => Promise<string | Buffer>;
            /** `writeFile` from `'node:fs/promises'` */
            writeFile: (filePath: string, contents: string | Buffer) => Promise<void>;
        };
        /** `existsSync` from `'node:fs'` */
        existsSync: (filePath: string) => boolean;
    };
    /**
     * Optional function that will automatically generate and save new secrets if the JSON file is
     * missing. This is particularly useful for dev or testing environments.
     */
    generateValues: (() => MaybePromise<SecretValues<Secrets>>) | undefined;
};

const defaultSecretsJsonFileAdapterOptions: SecretsJsonFileAdapterOptions = {
    fsOverride: {
        existsSync: existsSyncImport,
        promises: {
            readFile: readFileImport,
            writeFile: writeFileImport,
        },
    },
    generateValues: undefined,
};

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
export class SecretsJsonFileAdapter<
    const Secrets extends SecretDefinitions = any,
> extends BaseSecretsAdapter {
    protected readonly options: SecretsJsonFileAdapterOptions;

    constructor(
        /** Path to the JSON */
        protected readonly jsonFilePath: string,
        options: PartialWithUndefined<SecretsJsonFileAdapterOptions<Secrets>> = {},
    ) {
        super('SecretsJsonFileAdapter');

        this.options = mergeDefinedProperties(defaultSecretsJsonFileAdapterOptions, options);
    }

    /** Loads secrets from the given JSON file path. */
    public override async loadSecrets() {
        if (!this.options.fsOverride.existsSync(this.jsonFilePath)) {
            if (this.options.generateValues) {
                const newSecrets = await this.options.generateValues();
                await this.options.fsOverride.promises.writeFile(
                    this.jsonFilePath,
                    JSON.stringify(newSecrets),
                );
            } else {
                throw new Error(`Missing secrets JSON file at '${this.jsonFilePath}'`);
            }
        }

        const fileContents = String(
            await this.options.fsOverride.promises.readFile(this.jsonFilePath),
        );

        return parseWithJson5(fileContents);
    }
}
