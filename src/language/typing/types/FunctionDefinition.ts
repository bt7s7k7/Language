import { Span } from "../../Span"
import { Type } from "../Type"
import { SpecificFunction } from "./SpecificFunction"

export class FunctionDefinition extends Type {
    public canInstance() { return false }
    public getName() { return this.name }

    public readonly overloads: SpecificFunction[] = []

    public addOverload(overload: SpecificFunction) {
        this.overloads.push(overload)
        return this
    }
}
