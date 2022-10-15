import Dexie, { Table } from "dexie";

export interface ITempFile {
  id?: number;
  data: any;
  counter: number;
}

export class MyDB extends Dexie {
  files!: Table<ITempFile>;

  constructor() {
    super("tempfiles");
    this.version(1).stores({
      files: "++id, counter, data",
    });
  }
}

const db = new MyDB();
export default db;
