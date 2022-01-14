/* eslint-disable no-console */
import chalk = require("chalk")
import { readdir, readFile } from "fs/promises"
import { extname, join } from "path"
import { createInterface } from "readline"
import { Compiler } from "../language/Compiler"
import { BytecodeVM } from "../language/vm/BytecodeVM"
import { ANSIRenderer } from "../textFormatANSI/ANSIRenderer"
import { installStandardExtern } from "./standardExtern"

const rl = createInterface(process.stdin, process.stdout)
rl.pause()

void async function () {
    const target = process.argv[2]

    const compiler = new Compiler({
        readDir: async (path) => (await readdir(path, { withFileTypes: true })).map(v => ({
            name: v.name,
            path: join(path, v.name),
            type: v.isDirectory() ? "dir" : extname(v.name) == ".lenk" ? "code" : "other"
        })),
        readFile: async (path) => (await readFile(path)).toString(),
        printDiagnostic: (text) => console.log(ANSIRenderer.render(text))
    })

    if (target) {
        await compiler.addFile(target)
    } else {
        await compiler.addFolder(process.cwd())
    }

    const build = compiler.compile()
    if (!build) return
    const vm = new BytecodeVM(build.header, build.data)
    installStandardExtern(vm, build, rl)

    vm.directCall(vm.findFunction("main(): Void"), [], () => {
        rl.close()
    })
}().catch(err => {
    console.error(err)
    process.exit(1)
})
