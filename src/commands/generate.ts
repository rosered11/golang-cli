import {Command, Flags} from '@oclif/core'
import {existsSync, readFileSync, writeFileSync} from 'fs'
import {Json2Struct} from '../json2struct/json_to_struct'
import * as path from 'path'

export default class Generate extends Command {
  static description = 'Generate struct model for golang.'

  static args = [
    {
      name: 'file_name',
      description: 'Json soruce file for convert to struct.',
      required: true,
    }
  ];

  static flags = {
    split: Flags.boolean({
      char: 's',
      default: false,
      description: 'Split struct follow sub schema.'
    }),
  }

  async run() : Promise<void>{
    const {args, flags} = await this.parse(Generate)
    const fileExtension = '.go'
    const fileName = `${args.file_name}${args.file_name.slice(-3) === fileExtension ? '' : fileExtension}`
    const noteName = fileName.slice(0, -3)
    const locationFile = path.join(process.cwd(), args.file_name)
    const splitFlag = flags.split
    this.log(`path "${locationFile}"`)
    const file = readFileSync(locationFile, 'utf-8');

    let j2s = new Json2Struct()

    if (existsSync(fileName)) {
      this.log(`Note "${noteName}" already exists, use "edit" or "delete" instead`)
    } else {
      writeFileSync(fileName, `${j2s.jsonToStruct(file, null, splitFlag).go}`)
      this.log(`Created "${noteName}" note`)
    }
  }
}
