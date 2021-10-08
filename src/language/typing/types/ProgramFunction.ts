import { Span } from "../../Span"
import { Type } from "../Type"
import { Variable } from "../Variable"
import { SpecificFunction } from "./SpecificFunction"

export class ProgramFunction extends SpecificFunction {
    constructor(
        span: Span, name: string, result: Type, args: SpecificFunction.Argument[],
        public readonly body: Variable
    ) { super(span, name, result, args) }
}