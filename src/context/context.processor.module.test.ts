import { IsString } from 'class-validator';
import { WorkspaceFunction } from './functions.js';
import { ModuleRegistrationFunction } from './modules.js';

export class MyProcessor extends WorkspaceFunction<any> {
  @IsString()
  readonly value!: string;

  async _call(): Promise<any> {
    return { myProcessorConf: this.value };
  }

  _supports(): boolean {
    return true;
  }
}

export class MyOtherProcessor extends WorkspaceFunction<any> {
  @IsString()
  readonly value!: string;

  async _call(): Promise<any> {
    return { myOtherProcessorConf: this.value };
  }

  _supports(): boolean {
    return true;
  }
}

const registerModule: ModuleRegistrationFunction = async (context) => {
  context.registerFunctionImplementations(MyProcessor, MyOtherProcessor);
};

export default registerModule;
