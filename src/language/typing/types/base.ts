import { Span } from "../../Span"
import { Type } from "../Type"

export namespace Never {
    export const TYPE = new class Never extends Type {
        constructor() { super(Span.native, "never", Type.NOT_INSTANTIABLE) }
    }
}

export namespace Void {
    export const TYPE = new class Void extends Type {
        constructor() { super(Span.native, "void", 0) }
    }
}