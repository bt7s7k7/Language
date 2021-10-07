import { Span } from "../../Span"
import { ASTNode } from "../ASTNode"
import { TypeReferenceNode } from "./TypeReferenceNode"

export class DeclarationNode<T> extends ASTNode {
    constructor(
        span: Span,
        public readonly name: string,
        public readonly type: TypeReferenceNode | null = null,
        public readonly value: T | null = null
    ) { super(span) }
}

export class ArgumentDeclarationNode extends DeclarationNode<TypeReferenceNode> { }