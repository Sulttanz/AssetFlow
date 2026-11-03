import { zodResolver as resolverForZod } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { output, ZodType } from "zod";

/**
 * Keep React Hook Form's existing output-shaped form types while Zod 4's
 * resolver separately models schema input and parsed output types.
 */
export function zodResolver<TSchema extends ZodType<any, any, any>>(
  schema: TSchema,
): Resolver<output<TSchema> & FieldValues> {
  return resolverForZod(schema) as unknown as Resolver<output<TSchema> & FieldValues>;
}
