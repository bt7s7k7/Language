import { Span } from "../../Span"
import { ParentNode } from "../ParentNode"
import { ExpressionNode } from "./ExpressionNode"
import { StructNode } from "./StructNode"

export class NamespaceNode extends ParentNode {
    constructor(
        span: Span,
        public name: string | ExpressionNode,
        public struct: StructNode | null = null
    ) { super(span) }
}
