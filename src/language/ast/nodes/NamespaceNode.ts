import { Span } from "../../Span"
import { ParentNode } from "../ParentNode"
import { StructNode } from "./StructNode"

export class NamespaceNode extends ParentNode {
    constructor(
        span: Span,
        public name: string,
        public struct: StructNode | null = null
    ) { super(span) }
}
