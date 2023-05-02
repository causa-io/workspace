import { IsString, validate } from 'class-validator';
import 'jest-extended';
import { validatorOptions } from '../configuration.js';
import { IsNullable } from './is-nullable.decorator.js';

class MyObject {
  constructor(data?: Partial<MyObject>) {
    Object.assign(this, data);
  }

  @IsNullable()
  @IsString()
  value!: string | null;

  @IsString()
  nonNullableValue = '✅';
}

describe('IsNullable', () => {
  it('should skip validation when value is null', async () => {
    const type = new MyObject({ value: null });

    const errors = await validate(type, validatorOptions);

    expect(errors).toBeEmpty();
  });

  it('should fail when value is undefined', async () => {
    const type = new MyObject();

    const errors = await validate(type, validatorOptions);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('value');
  });

  it('should reject an invalid value', async () => {
    const type = new MyObject({ value: 12 as any });

    const errors = await validate(type, validatorOptions);

    expect(errors).toHaveLength(1);
  });

  it('should accept a valid value', async () => {
    const type = new MyObject({ value: '👍' });

    const errors = await validate(type, validatorOptions);

    expect(errors).toBeEmpty();
  });

  it('should reject a null value when the property is not nullable', async () => {
    const type = new MyObject({ value: '👍', nonNullableValue: null as any });

    const errors = await validate(type, validatorOptions);

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('nonNullableValue');
  });
});
