import { Span } from "../../Span"
import { Type } from "../Type"
import { Value } from "../Value"
import { SpecificFunction } from "./SpecificFunction"

export class ProgramFunction extends SpecificFunction {
    public match(span: Span, args: Type[], argSpans: Span[]) {
        const error = SpecificFunction.testArguments(span, this.args, args, argSpans)
        if (error) return error

        return {
            target: this,
            arguments: this.args,
            result: this.result
        }
    }

    constructor(
        span: Span, name: string,
        public readonly result: Type,
        public readonly args: ProgramFunction.Argument[],
        public readonly body: Value
    ) { super(span, `${name}(${args.map(v => `${v.name}: ${v.type.name}`).join(", ")}): ${result.name}`) }
}

export namespace ProgramFunction {
    export interface Argument extends SpecificFunction.Argument {
        span: Span
    }
}