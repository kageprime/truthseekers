declare module "isomorphic-git" {
  namespace git {
    function init(args: { fs: typeof import("fs"); dir: string }): Promise<void>;
    function add(args: { fs: typeof import("fs"); dir: string; filepath: string }): Promise<void>;
    function commit(args: {
      fs: typeof import("fs");
      dir: string;
      message: string;
      author: { name: string; email: string };
    }): Promise<string>;
    function log(args: {
      fs: typeof import("fs");
      dir: string;
      depth?: number;
      filepath?: string;
    }): Promise<Array<{ oid: string; commit: { message: string; committer: { timestamp: number } } }>>;
    function statusMatrix(args: {
      fs: typeof import("fs");
      dir: string;
    }): Promise<Array<[string, number, number, number]>>;
    function readBlob(args: {
      fs: typeof import("fs");
      dir: string;
      oid: string;
      filepath: string;
    }): Promise<{ blob: Uint8Array }>;
  }
  export default git;
}

declare module "isomorphic-git/http/node/index.js" {
  const http: Record<string, unknown>;
  export default http;
}
