import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { ExpressionNode } from "./ExpressionNode"

export class InvocationNode extends ASTNode {
    constructor(
        span: Span,
        public readonly target: ASTNode,
        public readonly args: ExpressionNode[]
    ) { super(span) }
}