import exp = require("constants")
import { unreachable } from "../../comTypes/util"
import { BlockNode } from "../ast/nodes/BlockNode"
import { ArgumentDeclarationNode } from "../ast/nodes/DeclarationNode"
import { ExpressionNode } from "../ast/nodes/ExpressionNode"
import { FunctionDefinitionNode } from "../ast/nodes/FunctionDefinitionNode"
import { IdentifierNode } from "../ast/nodes/IdentifierNode"
import { InvocationNode } from "../ast/nodes/InvocationNode"
import { OperatorNode } from "../ast/nodes/OperatorNode"
import { RootNode } from "../ast/nodes/RootNode"
import { TypeReferenceNode } from "../ast/nodes/TypeReferenceNode"
import { Diagnostic } from "../Diagnostic"
import { Position } from "../Position"
import { Span } from "../Span"
import { CharClass } from "./CharClass"
import { SourceFile } from "./SourceFile"
import { Token } from "./Token"

class ParsingFailure extends Error {
    public name = "ParsingFailure"
}

interface OperatorDefinition {
    name: string
    text: string
    type: "binary" | "prefix" | "suffix" | (() => void)
    presentence: number
}

declare module "../ast/nodes/OperatorNode" {
    export interface OperatorNode {
        meta: OperatorDefinition | null
    }
}

const OPERATORS: OperatorDefinition[] = [
    { name: "negate", text: "-", type: "prefix", presentence: 0 },
    { name: "mul", text: "*", type: "binary", presentence: 1 },
    { name: "add", text: "+", type: "binary", presentence: 2 },
    { name: "assign", text: "=", type: "binary", presentence: 3 },
]

const MAX_PRESENTENCE = 4

export namespace Parser {
    export function parse(file: SourceFile) {
        let index = 0
        let line = 0
        let column = 0

        const content = file.content

        function makePos() {
            return new Position(line, column, file)
        }

        function next() {
            if (content[index] == "\n") {
                line++
                column = 0
            } else {
                column++
            }
            index++
            if (index >= content.length) {
                throw new ParsingFailure("Unexpected EOF")
            }
        }

        function willEOF() {
            return index + 1 >= content.length
        }

        function skipWhitespace() {
            while (!willEOF() && CharClass.isWhitespace(content[index])) next()
        }

        function matches(key: string) {
            return content.startsWith(key, index)
        }

        function consume(key: string) {
            if (matches(key)) {
                for (let i = 0; i < key.length; i++) next()
                return true
            }

            return null
        }

        function parseRoot() {
            const rootNode = new RootNode(makePos().span(1))
            for (; ;) {
                skipWhitespace()
                if (willEOF()) break

                if (consume("function")) {
                    rootNode.addChild(parseFunctionStatement())
                    continue
                }

                throw new ParsingFailure("Unexpected character")
            }

            return rootNode
        }

        function consumeWord() {
            if (!CharClass.isWord(content[index])) return null
            const pos = makePos()
            const start = index
            while (CharClass.isWord(content[index])) next()
            const end = index
            const word = content.slice(start, end)
            return new Token(pos.span(end - start), word)
        }

        function parseEnumerated<T>(parser: () => T, delim: string | null, term: string) {
            if (consume(term)) {
                return []
            }

            const ret: T[] = []
            for (; ;) {
                skipWhitespace()


                const value = parser()
                if (value) {
                    ret.push(value)
                }

                skipWhitespace()

                if (consume(term)) {
                    break
                }

                if (delim && value && !consume(delim)) throw new ParsingFailure(`Expected "${delim}"`)
            }

            return ret
        }

        function postProcessExpression(expression: ExpressionNode) {
            for (let i = 0; i < MAX_PRESENTENCE; i++) {
                for (let ii = 0; ii < expression.children.length; ii++) {
                    const child = expression.children[ii]
                    if (child instanceof OperatorNode && child.meta && child.meta.presentence == i) {
                        if (child.meta.type == "binary") {
                            if (ii == 0) throw unreachable()
                            if (ii == expression.children.length - 1) throw unreachable()

                            const leftOperand = expression.children.splice(ii - 1, 1)[0]
                            child.addChild(leftOperand)
                            ii--
                            const rightOperand = expression.children.splice(ii + 1, 1)[0]
                            child.addChild(rightOperand)
                        } else if (child.meta.type == "prefix") {
                            if (ii == expression.children.length - 1) throw unreachable()
                            const operand = expression.children.splice(ii + 1, 1)[0]
                            child.addChild(operand)
                        } else if (child.meta.type == "suffix") {
                            if (ii == 0) throw unreachable()
                            const operand = expression.children.splice(ii - 1, 1)[0]
                            child.addChild(operand)
                            ii--
                        }

                        child.meta = null
                    }
                }
            }
        }

        function parseExpression() {
            const ret = new ExpressionNode(makePos().span(1))
            let hasTarget = false
            top: for (; ;) {
                skipWhitespace()

                const start = makePos()
                if (!hasTarget) {
                    for (const operator of OPERATORS) {
                        if (consume(operator.text)) {
                            if (operator.type != "prefix") continue
                            ret.addChild(new OperatorNode(start.span(operator.text.length), operator.name)).meta = operator
                            continue top
                        }
                    }

                    {
                        const identifier = consumeWord()
                        if (identifier) {
                            ret.addChild(new IdentifierNode(identifier.span, identifier.data))
                            hasTarget = true
                            continue
                        }
                    }

                    if (consume("(")) {
                        ret.addChild(parseExpression())
                        if (!consume(")")) throw new ParsingFailure(`Expected ")"`)
                        hasTarget = true
                        continue
                    }
                } else {
                    for (const operator of OPERATORS) {
                        if (consume(operator.text)) {
                            if (operator.type == "prefix") continue
                            if (operator.type == "binary") hasTarget = false
                            ret.addChild(new OperatorNode(start.span(operator.text.length), operator.name)).meta = operator
                            continue top
                        }
                    }

                    if (consume("(")) {
                        const target = ret.children.pop()!
                        const args: ExpressionNode[] = []
                        skipWhitespace()
                        if (!consume(")")) for (; ;) {
                            skipWhitespace()

                            args.push(parseExpression())

                            skipWhitespace()

                            if (consume(")")) break
                            if (!consume(",")) throw new ParsingFailure(`Expected expression or "," or ")"`)
                        }

                        ret.addChild(new InvocationNode(target.span, target, args))
                        continue
                    }
                }

                if (hasTarget) break

                throw new ParsingFailure("Expected expression")
            }

            postProcessExpression(ret)

            return ret
        }

        function parseBlock(term: string) {
            const block = new BlockNode(makePos().span(1))
            for (; ;) {
                skipWhitespace()

                if (consume(term)) {
                    break
                }

                block.addChild(parseExpression())

                skipWhitespace()
                consume(";")
            }

            return block
        }

        function parseType() {
            const ret = consumeWord()
            if (!ret) throw new ParsingFailure(`Expected type`)
            return new TypeReferenceNode(ret.span, ret.data)
        }

        function parseDeclaration<T, R>(valueParser: () => T, ctor: new (span: Span, name: string, type?: TypeReferenceNode | null, value?: T | null) => R) {
            const name = consumeWord()
            if (!name) throw new ParsingFailure("Expected identifier")
            skipWhitespace()
            const type = consume(":") && (skipWhitespace(), parseType())
            skipWhitespace()
            const value = consume("=") && (skipWhitespace(), valueParser())

            return new ctor(name.span, name.data, type, value)
        }

        function parseFunctionStatement() {
            skipWhitespace()
            const name = consumeWord()
            const start = makePos()
            skipWhitespace()
            const args = consume("(") ? parseEnumerated(() => parseDeclaration(parseType, ArgumentDeclarationNode), ",", ")") : []
            skipWhitespace()
            const body = consume("{") ? parseBlock("}") : null

            return new FunctionDefinitionNode(name?.span ?? start.span(1), name?.data ?? "[anonymous]", args, body)
        }

        try {
            return parseRoot()
        } catch (err) {
            if (err instanceof ParsingFailure) {
                return new Diagnostic(err.message, makePos().span(1))
            } else {
                throw err
            }
        }
    }
}