import { Injectable } from '@nestjs/common';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'BoundingBoxArray', async: false })
@Injectable()
export class BoundingBoxArrayConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!Array.isArray(value) || value.length === 0) {
      return false;
    }

    return value.every((entry) => {
      return (
        Array.isArray(entry) &&
        entry.length === 4 &&
        entry.every((part) => typeof part === 'number' && Number.isFinite(part))
      );
    });
  }

  defaultMessage(_args?: ValidationArguments): string {
    return 'bboxes must be an array of [x, y, width, height] numeric tuples';
  }
}

export function IsBoundingBoxArray(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options,
      constraints: [],
      validator: BoundingBoxArrayConstraint,
    });
  };
}
