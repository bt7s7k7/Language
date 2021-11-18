import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { IdentifierNode } from "./IdentifierNode"

export class TemplateNode extends ASTNode {
    constructor(
        span: Span,
        public readonly params: IdentifierNode[],
        public entity: ASTNode | null
    ) { super(span) }
}