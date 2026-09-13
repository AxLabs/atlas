export class BootstrapAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BootstrapAssetError";
  }
}
