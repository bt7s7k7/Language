import chalk = require("chalk")
import { BytecodeVM } from "../language/vm/BytecodeVM"
import { Instructions } from "../language/vm/Instructions"


const vm = new BytecodeVM({
    data: [],
    functions: [
        {
            name: "main",
            arguments: [
                {
                    name: "a",
                    size: 8
                }
            ],
            variables: [],
            returns: [
                {
                    name: "ret",
                    size: 4
                }
            ],
            labels: [],
            offset: 0,
            size: 20
        }
    ]
}, new Uint32Array([
    (Instructions.CONST << 16) | 1,
    0xff,
    (Instructions.STORE << 16) | 1,
    1,
    Instructions.RETURN << 16,
]).buffer)

const result = vm.directCall(0, [new Float64Array([101010]).buffer], 4)

console.log(result.as(Uint32Array))
