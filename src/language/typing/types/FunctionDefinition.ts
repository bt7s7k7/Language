import { Diagnostic } from "../../Diagnostic"
import { Span } from "../../Span"
import { Type } from "../Type"
import { SpecificFunction } from "./SpecificFunction"

export class FunctionDefinition extends Type {
    public canInstance() { return false }
    public getName() { return this.name }
    public findOverload(span: Span, args: SpecificFunction.ArgumentInfo[], context: SpecificFunction.Context) {
        let diagnostics = []
        for (const overload of this.overloads) {
            const match = overload.match(span, args, context)
            if (match instanceof Diagnostic) {
                diagnostics.push(match)
            } else if (match instanceof Array) {
                diagnostics.push(...match)
            } else {
                return match
            }
        }

        return diagnostics
    }

    public readonly overloads: SpecificFunction[] = []

    public addOverload(overload: SpecificFunction) {
        this.overloads.push(overload)
        return this
    }

    constructor(span: Span, name: string) {
        super(span, name, Type.NOT_INSTANTIABLE)
    }
}
