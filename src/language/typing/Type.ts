import { DebugInfo } from "../DebugInfo"
import { Span } from "../Span"

export abstract class Type {
    public assignableTo(other: Type): boolean {
        return other == this
    }

    public getDetail(debug: DebugInfo.Builder): Type.Detail | null {
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
    export interface Detail {
        base?: string
        props?: { type: string, offset: number, name: string }[]
    }

    export const NOT_INSTANTIABLE = -1

    export class RawData extends Type {
        constructor(
            size: number
        ) { super(Span.native, `RawData(${size})`, size) }
    }
}