import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { BlockNode } from "./BlockNode"
import { ExpressionNode } from "./ExpressionNode"

export class WhileNode extends ASTNode {
    constructor(
        span: Span,
        public readonly predicate: ExpressionNode,
        public readonly body: ExpressionNode | BlockNode
    ) { super(span) }
}