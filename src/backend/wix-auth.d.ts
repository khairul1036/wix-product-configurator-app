declare module 'wix-auth' {
  export function elevate<T extends (...args: any[]) => any>(fn: T): T;
}

declare module 'wix-data' {
  const wixData: any;
  export default wixData;
}


