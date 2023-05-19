import { IsString } from 'class-validator';
import { WorkspaceFunction } from './functions.js';
import { ModuleRegistrationFunction } from './modules.js';
import { ProcessorFunction, ProcessorResult } from './processor.js';

export class MyProcessor
  extends WorkspaceFunction<
    Promise<{
      configuration: Record<string, any>;
      someOtherOutput: string;
    }>
  >
  implements ProcessorFunction
{
  @IsString()
  readonly value!: string;

  async _call() {
    return {
      configuration: { myProcessorConf: this.value },
      someOtherOutput: this.value,
    };
  }

  _supports(): boolean {
    return true;
  }
}

export class MyOtherProcessor
  extends WorkspaceFunction<Promise<ProcessorResult>>
  implements ProcessorFunction
{
  @IsString()
  readonly value!: string;

  async _call() {
    return { configuration: { myOtherProcessorConf: this.value } };
  }

  _supports(): boolean {
    return true;
  }
}

export class MyInvalidProcessor extends WorkspaceFunction<any> {
  async _call() {
    return { nope: '😢' };
  }

  _supports(): boolean {
    return true;
  }
}

const registerModule: ModuleRegistrationFunction = async (context) => {
  context.registerFunctionImplementations(
    MyProcessor,
    MyOtherProcessor,
    MyInvalidProcessor,
  );
};

export default registerModule;
