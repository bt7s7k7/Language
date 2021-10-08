import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { ExpressionNode } from "./ExpressionNode"

export class ReturnStatementNode extends ASTNode {
    constructor(
        span: Span,
        public readonly body: ExpressionNode
    ) { super(span) }
}