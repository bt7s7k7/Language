import exp = require("constants")
import { unreachable } from "../../comTypes/util"
import { ASTNode } from "../ast/ASTNode"
import { ExpressionNode } from "../ast/nodes/ExpressionNode"
import { FunctionDefinitionNode } from "../ast/nodes/FunctionDefinitionNode"
import { IdentifierNode } from "../ast/nodes/IdentifierNode"
import { NumberLiteral } from "../ast/nodes/NumberLiteral"
import { RootNode } from "../ast/nodes/RootNode"
import { Diagnostic } from "../Diagnostic"
import { Argument } from "./expressions/Argument"
import { VariableDereference } from "./expressions/VariableDereference"
import { Double64 } from "./Number"
import { Type } from "./Type"
import { ConstExpr } from "./types/ConstExpr"
import { FunctionDefinition } from "./types/FunctionDefinition"
import { InstanceType } from "./types/InstanceType"
import { ProgramFunction } from "./types/ProgramFunction"
import { SpecificFunction } from "./types/SpecificFunction"
import { Variable } from "./Variable"

class ParsingError extends Error {
    public name = "ParsingError"
    public readonly diagnostics

    constructor(
        ...diagnostics: Diagnostic[]
    ) {
        super()
        this.diagnostics = diagnostics
    }
}

export namespace Typing {
    export class Scope {
        public map = new Map<string, Variable | Type>()

        public get(name: string): Variable | Type | undefined {
            return this.map.get(name) ?? this.parent?.get(name)
        }

        public register(name: string, value: Variable | Type) {
            if (this.map.has(name)) throw new ParsingError(new Diagnostic("Duplicate declaration", value.span), new Diagnostic("Declared here", this.map.get(name)!.span))
            this.map.set(name, value)
            return true
        }

        constructor(
            public readonly parent: Scope | null = null
        ) { }
    }

    export function parse(rootNode: RootNode, globalScope: Scope) {
        const rootScope = new Scope(globalScope)

        function parseExpressionNode(node: ASTNode, scope: Scope): Variable | Type {
            if (node instanceof ExpressionNode) {
                return parseExpressionNode(node.children[0], scope)
            } else if (node instanceof IdentifierNode) {
                const value = scope.get(node.name)
                if (!value) throw new ParsingError(new Diagnostic(`Cannot find name "${node.name}"`, node.span))
                if (value instanceof Type) return value
                return new VariableDereference(node.span, value)
            } else if (node instanceof NumberLiteral) {
                return new Double64.Constant(node.span, node.value, new ConstExpr(node.span, Double64.TYPE, node.value))
            } else throw new ParsingError(new Diagnostic(`Unknown node type ${node.constructor.name}`, node.span))
        }

        function parseFunctionDefinition(func: FunctionDefinitionNode, scope: Scope) {
            const name = func.name
            const innerScope = new Scope(scope)
            const args: SpecificFunction.Argument[] = []

            for (const argument of func.args) {
                const name = argument.name
                const typeExpr = argument.type
                if (!typeExpr) throw new ParsingError(new Diagnostic("Missing argument type", argument.span))
                if (argument.value) throw unreachable() // TODO: Implement default arguments

                const type = parseExpressionNode(typeExpr, innerScope)
                if (!(type instanceof InstanceType)) throw new ParsingError(new Diagnostic("Expected type", typeExpr.span), new Diagnostic("Declared here", type.span))

                args.push({ type, name })
                innerScope.register(name, new Argument(argument.span, type))
            }

            let resultType = func.type ? parseExpressionNode(func.type, innerScope) : null
            if (resultType != null && !(resultType instanceof Type)) throw new ParsingError(new Diagnostic("Expected type", func.type!.span))

            const body = func.body instanceof ExpressionNode ? parseExpressionNode(func.body, innerScope) : unreachable()
            if (!(body instanceof Variable)) throw new ParsingError(new Diagnostic("Expected variable result", func.span))

            if (resultType == null) resultType = body.type
            if (!body.type.assignableTo(resultType)) throw new ParsingError(new Diagnostic(`Return value "${body.type.name}" is not assignable to "${resultType.name}"`, func.span))

            scope.register(name, new FunctionDefinition(func.span, name).addOverload(new ProgramFunction(func.span, name, resultType, args, body)))
        }

        function parseRoot(root: RootNode, scope: Scope) {
            for (const node of root.children) {
                if (node instanceof FunctionDefinitionNode) {
                    parseFunctionDefinition(node, scope)
                } else throw new ParsingError(new Diagnostic(`Unknown node type ${node.constructor.name}`, node.span))
            }
        }

        try {
            parseRoot(rootNode, rootScope)
        } catch (err) {
            if (err instanceof ParsingError) {
                return err.diagnostics
            } else {
                throw err
            }
        }

        return rootScope.map
    }
}