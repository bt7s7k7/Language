import { unreachable } from "../../comTypes/util"
import { BlockNode } from "../ast/nodes/BlockNode"
import { DeclarationNode } from "../ast/nodes/DeclarationNode"
import { ExpressionNode } from "../ast/nodes/ExpressionNode"
import { FunctionDefinitionNode } from "../ast/nodes/FunctionDefinitionNode"
import { IdentifierNode } from "../ast/nodes/IdentifierNode"
import { IfStatementNode } from "../ast/nodes/IfStatementNode"
import { InvocationNode } from "../ast/nodes/InvocationNode"
import { NumberLiteral } from "../ast/nodes/NumberLiteral"
import { OperatorNode } from "../ast/nodes/OperatorNode"
import { ReturnStatementNode } from "../ast/nodes/ReturnStatement"
import { RootNode } from "../ast/nodes/RootNode"
import { VariableDeclarationNode } from "../ast/nodes/VariableDeclarationNode"
import { Diagnostic } from "../Diagnostic"
import { Position } from "../Position"
import { CharClass } from "./CharClass"
import { SourceFile } from "./SourceFile"
import { Token } from "./Token"
import exp = require("constants")

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
    { name: "subtract", text: "-", type: "binary", presentence: 2 },
    { name: "equals", text: "==", type: "binary", presentence: 3 },
    { name: "or", text: "||", type: "binary", presentence: 4 },
    { name: "assign", text: "=", type: "binary", presentence: 5 },
]

const MAX_PRESENTENCE = 6

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
            if (index >= content.length) {
                throw new ParsingFailure("Unexpected EOF")
            }
            index++
        }

        function willEOF() {
            return index >= content.length
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
            while (!willEOF() && CharClass.isWord(content[index])) next()
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

            if (expression.children.length > 1) throw unreachable()
        }

        function parseExpression() {
            skipWhitespace()
            const ret = new ExpressionNode(makePos().span(1))
            let hasTarget = false
            top: for (; ;) {
                skipWhitespace()

                const start = makePos()
                if (!willEOF() && !matches("=>")) if (!hasTarget) {
                    if (consume("var")) {
                        skipWhitespace()
                        const name = consumeWord()
                        if (!name) throw new ParsingFailure("Expected variable name")
                        skipWhitespace()
                        let type: ExpressionNode | null = null
                        if (consume(":")) {
                            skipWhitespace()
                            type = parseExpression()
                            skipWhitespace()
                        }
                        let body: ExpressionNode | null = null
                        if (consume("=")) {
                            skipWhitespace()
                            body = parseExpression()
                        }
                        ret.addChild(new VariableDeclarationNode(name.span, name.data, type, body))
                        hasTarget = true
                        continue
                    }

                    if (consume("if")) {
                        skipWhitespace()
                        const invert = consume("not") == true
                        skipWhitespace()
                        if (!consume("(")) throw new ParsingFailure(`Expected "("`)
                        const predicate = parseExpression()
                        if (!consume(")")) throw new ParsingFailure(`Expected ")"`)
                        skipWhitespace()
                        const body = consume("{") ? parseBlock("}") : parseExpression()
                        skipWhitespace()
                        const elseClause = consume("else") ? (skipWhitespace(), consume("{") ? parseBlock("}") : parseExpression()) : null
                        ret.addChild(new IfStatementNode(start.span(2), predicate, invert, body, elseClause))
                        hasTarget = true
                        continue
                    }

                    if (consume("return")) {
                        skipWhitespace()
                        const body = parseExpression()
                        ret.addChild(new ReturnStatementNode(start.span(6), body))
                        break
                    }

                    for (const operator of OPERATORS) {
                        if (matches(operator.text)) {
                            if (operator.type != "prefix") continue
                            consume(operator.text)
                            ret.addChild(new OperatorNode(start.span(operator.text.length), operator.name)).meta = operator
                            continue top
                        }
                    }

                    if (CharClass.isNumeric(content[index])) {
                        const type =
                            consume("0x") ? "hex" :
                                consume("0b") ? "bin" :
                                    "dec"

                        let src = ""
                        let isDecimal = false
                        if (type == "dec") while (!willEOF() && CharClass.isNumeric(content[index])) { src += content[index]; next() }
                        if (type == "hex") while (!willEOF() && CharClass.isHexDigit(content[index])) { src += content[index]; next() }
                        if (type == "bin") while (!willEOF() && (content[index] == "1" || content[index] == "0")) { src += content[index]; next() }

                        if (type == "dec") {
                            if (consume(".")) {
                                src += "."
                                isDecimal = true
                                while (!willEOF() && CharClass.isNumeric(content[index])) { src += content[index]; next() }
                            }

                            if (consume("e") || consume("E")) {
                                src += "e"
                                isDecimal = true
                                if (consume("+")) src += "+"
                                else if (consume("-")) src += "-"
                                while (!willEOF() && CharClass.isNumeric(content[index])) { src += content[index]; next() }
                            }
                        }

                        ret.addChild(new NumberLiteral(start.span(src.length),
                            type == "dec" ? (isDecimal ? parseFloat(src) : parseInt(src))
                                : parseInt(src, type == "hex" ? 16 : 2)
                        ))
                        hasTarget = true
                        continue
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
                        if (matches(operator.text)) {
                            if (operator.type == "prefix") continue
                            consume(operator.text)
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

        function parseDeclaration() {
            const name = consumeWord()
            if (!name) throw new ParsingFailure("Expected identifier")
            skipWhitespace()
            const type = consume(":") && (skipWhitespace(), parseExpression())
            skipWhitespace()
            const value = consume("=") && (skipWhitespace(), parseExpression())

            return new DeclarationNode(name.span, name.data, type, value)
        }

        function parseFunctionStatement() {
            skipWhitespace()
            const name = consumeWord()
            const start = makePos()
            skipWhitespace()
            const args = consume("(") ? parseEnumerated(() => parseDeclaration(), ",", ")") : []
            skipWhitespace()
            const type = consume(":") ? (skipWhitespace(), parseExpression()) : null
            skipWhitespace()
            let body = consume("{") ? parseBlock("}") : null
            if (!body) {
                consume("=>")
                body = parseExpression()
            }

            if (!body) throw new ParsingFailure("Expected function body")

            return new FunctionDefinitionNode(name?.span ?? start.span(1), name?.data ?? "[anonymous]", args, type, body)
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