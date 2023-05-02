import { IsEmail, IsString } from 'class-validator';
import 'jest-extended';
import { AllowMissing } from './decorators/index.js';
import { ValidationError } from './errors.js';
import { parseObject } from './parser.js';

class MyObject {
  @IsString()
  value1!: string;

  @IsEmail()
  @AllowMissing()
  emailValue?: string;
}

class MyEmptyObject {}

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
