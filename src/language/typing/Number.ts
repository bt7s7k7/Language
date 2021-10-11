import exp = require("constants")
import { Diagnostic } from "../Diagnostic"
import { Span } from "../Span"
import { Type } from "./Type"
import { ConstExpr } from "./types/ConstExpr"
import { InstanceType } from "./types/InstanceType"
import { SpecificFunction } from "./types/SpecificFunction"
import { Variable } from "./Variable"

export namespace Double64 {
    export const TYPE = new class Double64 extends InstanceType {
        constructor() { super(Span.native, "number") }
    }

    export class Constant extends Variable {
        constructor(
            span: Span,
            public readonly value: number,
            type = Double64.TYPE
        ) { super(span, type) }
    }

    export const CONST_ADD = new class extends SpecificFunction {
        public match(span: Span, args: Type[], argSpans: Span[]): SpecificFunction.Signature | Diagnostic {
            const types = SpecificFunction.testConstExpr<[number, number]>(span, [Double64.TYPE, Double64.TYPE], args, argSpans)
            if (types instanceof Diagnostic) return types

            const result = types[0] + types[1]

            return {
                target: this,
                arguments: args.map((v, i) => ({ name: "ab"[i], type: v })),
                result: new ConstExpr(span, Double64.TYPE, result)
            }
        }

        constructor() { super(Span.native, "__operator__add") }

    }
}