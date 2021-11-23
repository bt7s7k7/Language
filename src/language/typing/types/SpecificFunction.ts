import { DebugInfo } from "../../DebugInfo"
import { Diagnostic } from "../../Diagnostic"
import { Span } from "../../Span"
import { Type } from "../Type"
import { Typing } from "../Typing"
import { ConstExpr } from "./ConstExpr"
import { Reference } from "./Reference"

export abstract class SpecificFunction extends Type {
    public abstract match(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context): SpecificFunction.Signature | Diagnostic | Diagnostic[]

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

    export interface ArgumentInfo {
        span: Span
        type: Type
    }

    export interface Context {
        scope: Typing.Scope
        rootScope: Typing.Scope
        debug: DebugInfo.Builder
    }

    export interface Signature {
        target: SpecificFunction
        result: Type
        arguments: Argument[]
    }

    export function testArguments(span: Span, target: SpecificFunction.Argument[], args: ArgumentInfo[]) {
        if (args.length != target.length) return new Diagnostic(`Expected ${target.length} argument, got ${args.length}`, span)

        for (let i = 0; i < target.length; i++) {
            if (!args[i].type.assignableTo(target[i].type)) {
                let targetType = target[i].type
                if (targetType instanceof Reference) {
                    if (args[i].type.assignableTo(targetType.type)) {
                        return new Diagnostic(`Argument "${target[i].name}" must be a reference value`, args[i].span)
                    } else {
                        targetType = targetType.type
                    }
                }
                return new Diagnostic(`Argument of type "${args[i].type.name}" is not assignable to "${target[i].name}: ${targetType.name}"`, args[i].span)
            }
        }

        return null
    }

    export function testConstExpr<T extends any[]>(span: Span, target: { [P in keyof T]: Type }, args: ArgumentInfo[]) {
        if (args.length != target.length) return new Diagnostic(`Expected ${target.length} argument, got ${args.length}`, span)

        for (let i = 0; i < target.length; i++) {
            const arg = args[i].type
            if (arg instanceof ConstExpr && arg.type.assignableTo(target[i])) {/**/ } else {
                return new Diagnostic(`Argument is not correctly constexpr`, args[i].span)
            }
        }

        return args.map(v => (v.type as ConstExpr).value) as T
    }
}