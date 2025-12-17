declare module "elfy" {
  export interface ELFHeader {
    class: number;
    data: number;
    version: number;
    osabi?: number;
    type: number;
    machine: number;
    entry: number;
    phoff?: number;
    shoff?: number;
    flags?: number;
    ehsize?: number;
    phentsize?: number;
    phnum?: number;
    shentsize?: number;
    shnum?: number;
    shstrndx?: number;
  }

  export interface ELFSection {
    name: string;
    type: number;
    flags?: number;
    addr: number;
    offset: number;
    size: number;
    link?: number;
    info?: number;
    addralign?: number;
    entsize?: number;
    symbols?: any[];
    entries?: any[];
    notes?: any[];
  }

  export interface ELFProgramHeader {
    type: number;
    offset: number;
    vaddr: number;
    paddr: number;
    filesz: number;
    memsz: number;
    flags: number;
    align: number;
  }

  export interface ELFData {
    header: ELFHeader;
    body?: { programHeaders?: ELFProgramHeader[]; sections?: ELFSection[] };
  }

  export function parse(buffer: Buffer): ELFData;
}
