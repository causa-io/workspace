import { ValidateIf, ValidationOptions } from 'class-validator';

/**
 * Allows the decorated property to be `undefined`.
 *
 * @param options Validation options.
 */
export function AllowMissing(options?: ValidationOptions): PropertyDecorator {
  return function AllowMissingDecorator(
    prototype: object,
    propertyKey: string | symbol,
  ) {
    ValidateIf((obj) => obj[propertyKey] !== undefined, options)(
      prototype,
      propertyKey,
    );
  };
}
