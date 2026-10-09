import { IsEmail, IsString } from 'class-validator';
import 'jest-extended';
import { AllowMissing } from './decorators/index.js';
import { ValidationError } from './errors.js';
import { parseObject, validateObject } from './parser.js';

class MyObject {
  @IsString()
  value1!: string;

  @IsEmail()
  @AllowMissing()
  emailValue?: string;
}

class MyEmptyObject {}

class MyUndecoratedObject {
  value?: string;
}

describe('parseObject', () => {
  it('should return the transformed and validated object', async () => {
    const obj = { value1: '✨' };

    const actual = await parseObject(MyObject, obj);

    expect(actual).toEqual(obj);
    expect(actual).toBeInstanceOf(MyObject);
  });

  it('should throw a validation error when the input payload is invalid', async () => {
    const obj = { value1: 123, emailValue: '📫', forbidden: '🙅' };

    const actualPromise = parseObject(MyObject, obj);

    await expect(actualPromise).rejects.toThrow(ValidationError);
    await expect(actualPromise).rejects.toMatchObject({
      validationMessages: expect.toSatisfy((messages: string[]) => {
        return ['value1', 'emailValue', 'forbidden'].every((key) =>
          messages.some((m) => m.includes(key)),
        );
      }),
    });
  });

  it('should validate an expected empty object', async () => {
    const actual = await parseObject(MyEmptyObject, {});

    expect(actual).toEqual({});
    expect(actual).toBeInstanceOf(MyEmptyObject);
  });

  it('should throw a validation error when the object is not empty', async () => {
    const actualPromise = parseObject(MyEmptyObject, { notEmpty: '🎁' });

    await expect(actualPromise).rejects.toThrow(ValidationError);
    await expect(actualPromise).rejects.toMatchObject({
      validationMessages: ['Expected the object to validate to be empty.'],
    });
  });
});

describe('validateObject', () => {
  it('should return the validated object without copying it', async () => {
    const payload = { value1: '✨' };
    const obj = Object.assign(new MyObject(), payload);

    const actual = await validateObject(obj);

    expect(actual).toBe(obj);
  });

  it('should throw a validation error when the object is invalid', async () => {
    const payload = { value1: 123 };
    const obj = Object.assign(new MyObject(), payload);

    const actualPromise = validateObject(obj);

    await expect(actualPromise).rejects.toThrow(ValidationError);
  });

  it('should validate an expected empty object', async () => {
    const obj = new MyEmptyObject();

    const actual = await validateObject(obj);

    expect(actual).toBe(obj);
  });

  it('should validate an empty class with undecorated properties that have not been set', async () => {
    const obj = new MyUndecoratedObject();

    const actual = await validateObject(obj);

    expect(actual).toBe(obj);
  });

  it('should throw a validation error when properties have been set on an empty class', async () => {
    const obj = Object.assign(new MyUndecoratedObject(), { value: '🎁' });

    const actualPromise = validateObject(obj);

    await expect(actualPromise).rejects.toMatchObject({
      validationMessages: ['Expected the object to validate to be empty.'],
    });
  });
});
