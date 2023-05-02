import { IsString, validate } from 'class-validator';
import 'jest-extended';
import { validatorOptions } from '../configuration.js';
import { AllowMissing } from './allow-missing.decorator.js';

class MyObject {
  constructor(data: MyObject) {
    Object.assign(this, data);
  }

  @AllowMissing()
  @IsString()
  value?: string;

  @IsString()
  requiredValue!: string;
}

describe('AllowMissing', () => {
  it('should skip validation when value is undefined', async () => {
    const type = new MyObject({
      requiredValue: '✅',
    });

    const errors = await validate(type, validatorOptions);

    expect(errors).toBeEmpty();
  });

  it('should fail when value is null', async () => {
    const type = new MyObject({ value: null as any, requiredValue: '🤷' });

    const errors = await validate(type, validatorOptions);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('value');
  });

  it('should reject a value that does not pass other validators', async () => {
    const type = new MyObject({ value: 12 as any, requiredValue: 'good' });

    const errors = await validate(type, validatorOptions);

    expect(errors).toHaveLength(1);
  });

  it('should accept a valid value', async () => {
    const type = new MyObject({ value: '✅', requiredValue: '😊' });

    const errors = await validate(type, validatorOptions);

    expect(errors).toBeEmpty();
  });

  it('should reject an undefined value for a property which cannot be missing', async () => {
    const type = new MyObject({} as any);

    const errors = await validate(type, validatorOptions);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('requiredValue');
  });
});
