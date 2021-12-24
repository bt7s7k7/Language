import { unreachable } from "../../comTypes/util"
import { EmissionUtil } from "../emission/EmissionUtil"
import { FunctionIRBuilder } from "../emission/FunctionIRBuilder"
import { Span } from "../Span"
import { Type } from "./Type"
import { Never } from "./types/base"

export abstract class Value {
    public emit(builder: FunctionIRBuilder): number {
        throw new Error(`Cannot emit ${this.constructor.name}`)
    }

    constructor(
        public readonly span: Span,
        public readonly type: Type
    ) { }
}

export abstract class LanguageConstant extends Value { }