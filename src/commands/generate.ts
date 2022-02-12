import {Command, Flags} from '@oclif/core'
import {existsSync, readFileSync, writeFileSync} from 'fs'
import {Json2Struct} from '../json2struct/json_to_struct'
import * as path from 'path'

export default class Generate extends Command {
  static description = 'Generate struct model for golang.'

  static args = [
    {
      name: 'json_source',
      description: 'json soruce file for convert to struct.',
      required: true,
    },
    {
      name: 'out_struct',
      description: 'output generate struct file'
    }
  ];

  async run() : Promise<void>{
    const {args} = await this.parse(Generate)
    const fileExtension = '.go'
    const fileName = `${args.json_source}${args.json_source.slice(-3) === fileExtension ? '' : fileExtension}`
    const noteName = fileName.slice(0, -3)
    const locationFile = path.join(process.cwd(), args.json_source)
    this.log(`path "${locationFile}"`)
    const file = readFileSync(locationFile, 'utf-8');

    let j2s = new Json2Struct()
    //this.log(`output "${j2s.jsonToStruct(file).go}"`)

    if (existsSync(fileName)) {
      this.log(`Note "${noteName}" already exists, use "edit" or "delete" instead`)
    } else {
      writeFileSync(fileName, `${j2s.jsonToStruct(file).go}`)
      this.log(`Created "${noteName}" note`)
    }
  }
}
