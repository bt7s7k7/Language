import chalk = require("chalk")
import { inspect } from "util"
import { Diagnostic } from "../language/Diagnostic"
import { Parser } from "../language/parsing/Parser"
import { SourceFile } from "../language/parsing/SourceFile"
import { Position } from "../language/Position"
import { Span } from "../language/Span"
import { Double64 } from "../language/typing/Number"
import { FunctionDefinition } from "../language/typing/types/FunctionDefinition"
import { ProgramFunction } from "../language/typing/types/ProgramFunction"
import { Typing } from "../language/typing/Typing"
import { stringifySpan } from "../language/util"

// @ts-ignore
Span.prototype[inspect.custom] = function (this: Span) {
    if (this == Span.native) return chalk.blueBright("<native>")
    return "\n" + chalk.blueBright(stringifySpan(this.pos.file, this.pos.line, this.pos.column, this.length))
}

// @ts-ignore
Position.prototype._s = Position.prototype[inspect.custom] = function (this: Position) {
    return "\n" + chalk.blueBright(stringifySpan(this.file, this.line, this.column, 1))
}

const ast = Parser.parse(new SourceFile("<anon>",
    /* `
 function fibonacci(i: int) {
     if (i == 0 || i == 1) return 0
     return fibonacci(i - 1) + fibonacci(i - 2)
 }
 
 function main() {
     return fibonacci(6)
 }
 ` */
    `function f() => 2 + 3 + 6 + 7`
))
if (ast instanceof Diagnostic) {
    console.log(inspect(ast, undefined, Infinity, true))
} else {
    const globalScope = new Typing.Scope()

    globalScope.register("number", Double64.TYPE)
    globalScope.register("__operator__add", new FunctionDefinition(Span.native, "__operator__add")
        .addOverload(Double64.CONST_ADD)
        .addOverload(new ProgramFunction(Span.native, "__operator__add", Double64.TYPE, [{ name: "a", type: Double64.TYPE }, { name: "b", type: Double64.TYPE }], new Double64.Constant(Span.native, 0)))
    )

    const scope = Typing.parse(ast, globalScope)

    console.log(inspect(scope, undefined, Infinity, true))
}