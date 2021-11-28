import { Span } from "../../Span"
import { Type } from "../Type"

export class NamespaceRef extends Type {
    constructor(
        span: Span,
        name: string
    ) { super(span, name, Type.NOT_INSTANTIABLE) }
}