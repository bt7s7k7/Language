import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"

export class TypeReferenceNode extends ASTNode {
    constructor(
        span: Span,
        public readonly name: string
    ) { super(span) }
}