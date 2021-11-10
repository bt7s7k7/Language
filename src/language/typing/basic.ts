import { Diagnostic } from "../Diagnostic"
import { Span } from "../Span"
import { SpecificFunction } from "./types/SpecificFunction"

export const GENERIC_ASSIGN = new class GenericAssign extends SpecificFunction {
    public match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic {
        const target = [{ name: "target", type: args[0].type }, { name: "value", type: args[0].type }]
        const error = SpecificFunction.testArguments(span, target, args)
        if (error) return error

        return {
            target: this,
            arguments: target,
            result: target[0].type
        }
    }

    constructor() { super(Span.native, "__genericAssignOperator") }
}