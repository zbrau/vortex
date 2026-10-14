declare module 'tree-kill' {
  function treeKill(pid: number, signal?: string | number, callback?: (error?: Error) => void): void;
  export = treeKill;
}

declare module '*.png' {
  const content: string;
  export default content;
}

