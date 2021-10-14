import { Diagnostic } from "../Diagnostic"
import { Span } from "../Span"
import { Type } from "./Type"
import { SpecificFunction } from "./types/SpecificFunction"

export const GENERIC_ASSIGN = new class GenericAssign extends SpecificFunction {
    public match(span: Span, args: Type[], argSpans: Span[]): SpecificFunction.Signature | Diagnostic {
        const target = [{ name: "target", type: args[0] }, { name: "value", type: args[0] }]
        const error = SpecificFunction.testArguments(span, target, args, argSpans)
        if (error) return error

        return {
            target: this,
            arguments: target,
            result: target[0].type
        }
    }

    constructor() { super(Span.native, "__genericAssignOperator") }
}