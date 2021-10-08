import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { ExpressionNode } from "./ExpressionNode"

export class DeclarationNode extends ASTNode {
    constructor(
        span: Span,
        public readonly name: string,
        public readonly type: ExpressionNode | null = null,
        public readonly value: ExpressionNode | null = null
    ) { super(span) }
}
