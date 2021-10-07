import chalk = require("chalk")
import { inspect } from "util"
import { Parser } from "../language/parsing/Parser"
import { SourceFile } from "../language/parsing/SourceFile"
import { Position } from "../language/Position"
import { Span } from "../language/Span"
import { stringifySpan } from "../language/util"

// @ts-ignore
Span.prototype[inspect.custom] = function (this: Span) {
    return "\n" + chalk.blueBright(stringifySpan(this.pos.file, this.pos.line, this.pos.column, this.length))
}

// @ts-ignore
Position.prototype._s = Position.prototype[inspect.custom] = function (this: Position) {
    return "\n" + chalk.blueBright(stringifySpan(this.file, this.line, this.column, 1))
}

const result = Parser.parse(new SourceFile("<anon>",
    `
function main(argc: int) {
    print(hello, world());
    foo();
}
`
))

console.log(inspect(result, undefined, Infinity, true))