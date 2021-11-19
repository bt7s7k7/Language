import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { ExpressionNode } from "./ExpressionNode"

export class TupleNode extends ASTNode {
    constructor(
        span: Span,
        public readonly elements: ExpressionNode[]
    ) { super(span) }
}