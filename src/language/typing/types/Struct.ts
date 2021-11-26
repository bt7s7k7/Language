import { DebugInfo } from "../../DebugInfo"
import { Span } from "../../Span"
import { Type } from "../Type"
import { MemberAccess } from "../values/MemberAccess"

export class Struct extends Type {
    public getDetail(debug: DebugInfo.Builder) {
        return {
            struct: true,
            shape: this.properties.map(v => ({ type: debug.type(v.type).name, offset: v.offset, name: v.name }))
        }
    }

    constructor(
        span: Span, name: string, size: number,
        public readonly properties: MemberAccess.Property[]
    ) { super(span, name, size) }
}