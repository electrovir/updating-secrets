import {BaseSecretsAdapter, type ProcessedSecretDefinitions} from '../index.js';

export class MyCustomSecretsAdapter extends BaseSecretsAdapter {
    constructor() {
        super('MyCustomSecretsAdapter');
    }

    public override loadSecrets(secrets: Readonly<ProcessedSecretDefinitions>) {
        // load secrets here
        return {};
    }
}
