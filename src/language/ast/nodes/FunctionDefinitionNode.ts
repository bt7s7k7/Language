import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { BlockNode } from "./BlockNode"
import { DeclarationNode } from "./DeclarationNode"
import { ExpressionNode } from "./ExpressionNode"

export class FunctionDefinitionNode extends ASTNode {
    constructor(
        span: Span,
        public readonly name: string,
        public readonly args: DeclarationNode[],
        public readonly type: ExpressionNode | null,
        public readonly body: BlockNode
    ) { super(span) }
}