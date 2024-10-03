import { WorkspaceContext } from './context.js';
import { WorkspaceFunction } from './functions.js';
import type { ModuleRegistrationFunction } from './modules.js';

type MyConfiguration = {
  myFunction?: {
    returnValue?: string;
  };
};

export abstract class MyFunction extends WorkspaceFunction<string> {}

export class MyFunctionImpl extends MyFunction {
  _call(context: WorkspaceContext): string {
    return context
      .asConfiguration<MyConfiguration>()
      .getOrThrow('myFunction.returnValue');
  }

  _supports(): boolean {
    return true;
  }
}

const registerModule: ModuleRegistrationFunction = async (context) => {
  context.registerFunctionImplementations(MyFunctionImpl);
};

export default registerModule;
