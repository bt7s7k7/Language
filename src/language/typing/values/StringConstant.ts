import { TextEncoder } from "util"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Primitives } from "../Primitives"
import { Type } from "../Type"
import { Pointer } from "../types/Pointer"
import { Slice } from "../types/Slice"
import { Value } from "../Value"

export class StringConstant extends Value {
    public emit(builder: FunctionIRBuilder) {
        const name = `[${builder.globalIndex}]_string_${builder.nextID()}`
        const stringData = new TextEncoder().encode(this.value).buffer
        builder.registerData(name, stringData, this.span)

        builder.pushInstruction(Instructions.DATA_PTR, 0, [name])
        new Primitives.Number.Constant(Span.native, stringData.byteLength).emit(builder)

        return Pointer.size + Primitives.Number.TYPE.size
    }

    constructor(
        span: Span,
        public readonly value: string,
        type: Type = new Slice(Primitives.Char.TYPE)
    ) { super(span, type) }
}