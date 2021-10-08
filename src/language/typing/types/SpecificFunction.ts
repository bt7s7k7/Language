import { Span } from "../../Span"
import { Type } from "../Type"

export abstract class SpecificFunction extends Type {
    constructor(
        span: Span,
        name: string,
        public readonly result: Type,
        public readonly args: SpecificFunction.Argument[]
    ) { super(span, `name(${args.map(v => `${v.name}: ${v.type.name}`).join(", ")}): ${result.name}`) }
}

export namespace SpecificFunction {
    export interface Argument {
        type: Type
        name: string
    }
}