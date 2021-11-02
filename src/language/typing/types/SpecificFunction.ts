import exp = require("constants")
import { Diagnostic } from "../../Diagnostic"
import { Span } from "../../Span"
import { Type } from "../Type"
import { ConstExpr } from "./ConstExpr"
import { Reference } from "./Reference"

export abstract class SpecificFunction extends Type {
    public abstract match(span: Span, args: Type[], argSpans: Span[]): SpecificFunction.Signature | Diagnostic

    constructor(
        span: Span,
        name: string,
    ) { super(span, name, Type.NOT_INSTANTIABLE) }
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
                let targetType = target[i].type
                if (targetType instanceof Reference) {
                    if (args[i].assignableTo(targetType.type)) {
                        return new Diagnostic(`Argument "${target[i].name}" must be a reference value`, argSpans[i])
                    } else {
                        targetType = targetType.type
                    }
                }
                return new Diagnostic(`Argument of type "${args[i].name}" is not assignable to "${target[i].name}: ${targetType.name}"`, argSpans[i])
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