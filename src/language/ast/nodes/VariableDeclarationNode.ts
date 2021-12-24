import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { ExpressionNode } from "./ExpressionNode"

export class VariableDeclarationNode extends ASTNode {
    constructor(
        span: Span,
        public readonly name: string,
        public readonly type: ExpressionNode | null,
        public readonly body: ExpressionNode | null,
        public readonly defer: boolean
    ) { super(span) }
}