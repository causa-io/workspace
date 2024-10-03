import { InvalidSecretDefinitionError } from './errors.js';
import type { ModuleRegistrationFunction } from './modules.js';
import { SecretFetch } from './secrets.js';

export class MySecretBackend extends SecretFetch {
  async _call(): Promise<string> {
    if (this.backend === 'invalidDefinition') {
      throw new InvalidSecretDefinitionError('🙅');
    }

    return JSON.stringify({
      backend: this.backend,
      configuration: this.configuration,
    });
  }

  _supports(): boolean {
    return this.backend !== 'unknown';
  }
}

const registerModule: ModuleRegistrationFunction = async (context) => {
  context.registerFunctionImplementations(MySecretBackend);
};

export default registerModule;
