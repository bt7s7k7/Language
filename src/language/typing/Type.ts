import { Span } from "../Span"
import { ConstExpr } from "./types/ConstExpr"
import { FunctionDefinition } from "./types/FunctionDefinition"
import { MemberAccess } from "./values/MemberAccess"

export abstract class Type {
    public assignableTo(other: Type): boolean {
        return other == this
    }

    public getProperty(key: string): FunctionDefinition | ConstExpr | MemberAccess.Property | null {
        return null
    }

    constructor(
        public readonly span: Span,
        public name: string,
        public readonly size: number
    ) { }
}

export namespace Type {
    export const TYPE = new class TypeType extends Type { constructor() { super(Span.native, "Type", Type.NOT_INSTANTIABLE) } }

    export const NOT_INSTANTIABLE = -1
}