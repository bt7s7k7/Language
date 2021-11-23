import { DebugInfo } from "../DebugInfo"
import { Span } from "../Span"

export abstract class Type {
    public assignableTo(other: Type): boolean {
        return other == this
    }

    public getDetail(debug: DebugInfo.Builder): any {
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