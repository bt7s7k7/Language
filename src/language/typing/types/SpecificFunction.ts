import exp = require("constants")
import { Diagnostic } from "../../Diagnostic"
import { Span } from "../../Span"
import { Type } from "../Type"
import { ConstExpr } from "./ConstExpr"

export abstract class SpecificFunction extends Type {
    public abstract match(span: Span, args: Type[], argSpans: Span[]): SpecificFunction.Signature | Diagnostic

    constructor(
        span: Span,
        name: string,
    ) { super(span, name) }
}

export namespace SpecificFunction {
    export interface Argument {
        type: Type
        name: string
    }

    export interface Signature {
        target: SpecificFunction
        result: Type
        arguments: Argument[]
    }

    export function testArguments(span: Span, target: SpecificFunction.Argument[], args: Type[], argSpans: Span[]) {
        if (args.length != target.length) return new Diagnostic(`Expected ${target.length} argument, got ${args.length}`, span)

        for (let i = 0; i < target.length; i++) {
            if (!args[i].assignableTo(target[i].type)) {
                return new Diagnostic(`Argument of type "${args[i].name}" is not assignable to "${target[i].name}: ${target[i].type.name}"`, argSpans[i])
            }
        }

        return null
    }

    export function testConstExpr<T extends any[]>(span: Span, target: { [P in keyof T]: Type }, args: Type[], argSpans: Span[]) {
        if (args.length != target.length) return new Diagnostic(`Expected ${target.length} argument, got ${args.length}`, span)

        for (let i = 0; i < target.length; i++) {
            const arg = args[i]
            if (arg instanceof ConstExpr && arg.type.assignableTo(target[i])) {/**/ } else {
                return new Diagnostic(`Argument is not correctly constexpr`, argSpans[i])
            }
        }

        return args.map(v => (v as ConstExpr).value) as T
    }
}