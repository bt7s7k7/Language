import { unreachable } from "../../../comTypes/util"
import { EmissionUtil } from "../../emission/EmissionUtil"
import { FunctionIRBuilder } from "../../emission/FunctionIRBuilder"
import { Span } from "../../Span"
import { Instructions } from "../../vm/Instructions"
import { Type } from "../Type"
import { Pointer } from "../types/Pointer"
import { Value } from "../Value"

export class ConcatValue extends Value {
    public emit(builder: FunctionIRBuilder): number {
        for (const child of this.children) {
            EmissionUtil.safeEmit(builder, child.type.size, child)
        }

        return this.type.size
    }
    constructor(
        span: Span, type: Type,
        public readonly children: Value[]
    ) {
        super(span, type)
        const childrenSize = this.children.reduce((a, v) => a + v.type.size, 0)
        if (childrenSize != type.size) unreachable(`The combined size of children (${childrenSize}) should equal the size of result type (${type.size})`)
    }
}

export class ConstValue extends Value {
    public emit(builder: FunctionIRBuilder): number {
        EmissionUtil.emitConstant(builder, this.data)
        return this.data.byteLength
    }

    constructor(
        span: Span, type: Type,
        public readonly data: ArrayBuffer
    ) {
        super(span, type)
        if (data.byteLength != type.size) unreachable(`The size of data (${data.byteLength}) should equal the size of result type (${type.size})`)
    }
}

export class AllocValue extends Value {
    public emit(builder: FunctionIRBuilder): number {
        const size = this.value.type.size
        builder.pushInstruction(Instructions.ALLOC, size)
        builder.pushInstruction(Instructions.STACK_COPY, 8)
        EmissionUtil.safeEmit(builder, size, this.value)
        builder.pushInstruction(Instructions.STORE_PTR_ALT, size)

        return 8
    }

    constructor(
        span: Span,
        public readonly value: Value
    ) { super(span, new Pointer(value.type)) }
}