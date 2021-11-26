import { DebugInfo } from "../../DebugInfo"
import { Span } from "../../Span"
import { Type } from "../Type"
import { MemberAccess } from "../values/MemberAccess"
import { InstanceType } from "./InstanceType"

export class Struct extends InstanceType {
    public properties: MemberAccess.Property[] = []
    public size = Type.NOT_INSTANTIABLE

    public getDetail(debug: DebugInfo.Builder) {
        return {
            struct: true,
            shape: this.properties.map(v => ({ type: v.type.name, offset: v.offset, name: v.name }))
        }
    }

    public finalize(properties: MemberAccess.Property[], size: number, debug: DebugInfo.Builder) {
        this.properties = properties
        this.size = size

        debug.type(this)
            .setDetail(this.getDetail(debug))
            .setSize(this.size)
    }

    constructor(
        span: Span, name: string,
    ) { super(span, name, Type.NOT_INSTANTIABLE) }
}