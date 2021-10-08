import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { BlockNode } from "./BlockNode"
import { ExpressionNode } from "./ExpressionNode"

export class IfStatementNode extends ASTNode {
    constructor(
        span: Span,
        public readonly predicate: ExpressionNode,
        public readonly invert: boolean,
        public readonly body: ExpressionNode | BlockNode,
        public readonly bodyElse: ExpressionNode | BlockNode | null
    ) { super(span) }
}