import { type ClassConstructor, plainToInstance } from 'class-transformer';
import {
  ValidationError as ClassValidationError,
  type ValidatorOptions,
  getMetadataStorage,
  validate,
} from 'class-validator';
import { validatorOptions } from './configuration.js';
import { ValidationError } from './errors.js';

/**
 * Flattens all the validation error messages contained in the given errors and their children.
 *
 * @param errors The errors returned by `class-validator`'s {@link validate}.
 * @returns The error messages.
 */
function getErrorMessages(errors: ClassValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...getErrorMessages(error.children ?? []),
  ]);
}

/**
 * Transforms and parses the input payload into the given type.
 * If the expected type is an empty class, payload will pass validation if it is an empty object.
 * This is different from `class-validator` base implementation, which does not support empty classes with no decorator.
 *
 * @param type The type of object to parse.
 * @param payload The input payload to parse.
 * @param options {@link ValidatorOptions} to use when validating the object.
 *   By default, the {@link validatorOptions} will be inherited.
 * @returns The parsed object.
 * @throws {@link ValidationError} If one or more errors occur during parsing.
 */
export async function parseObject<T extends object>(
  type: ClassConstructor<T>,
  payload: any,
  options: ValidatorOptions = {},
): Promise<T> {
  const classObject = plainToInstance(type, payload);

  const metadata = getMetadataStorage().getTargetValidationMetadatas(
    classObject.constructor,
    undefined as any,
    false,
    false,
  );
  if (metadata.length === 0) {
    // `class-validator` does not support validating empty classes, i.e. with no decorated properties.
    // This assumes that such classes simply expect empty objects.
    if (Object.keys(payload).length === 0) {
      return classObject;
    }

    // Throwing an error that is clearer than the message returned by `class-validator` in this case:
    // "an unknown value was passed to the validate function."
    throw new ValidationError(['Expected the object to validate to be empty.']);
  }

  const errors = await validate(classObject, {
    ...validatorOptions,
    ...options,
  });
  if (errors.length > 0) {
    const validationMessages = getErrorMessages(errors);
    throw new ValidationError(validationMessages);
  }

  return classObject;
}
