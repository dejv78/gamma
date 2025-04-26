import {Application} from "pixi.js";
import {Image} from "../image/image";

export abstract class PixiView {

  protected resizeObserver?: ResizeObserver;
  protected app: Application = new Application();
  protected width: number = 0;
  protected height: number = 0;
  protected centerX: number = 0;
  protected centerY: number = 0;

  public async init(element: HTMLElement) {
    await this.app.init({antialias: true, resizeTo: element});
    element.appendChild(this.app.canvas);
    await this.initHandlers();
    await this.resize(this.app.screen.width, this.app.screen.height);

    this.resizeObserver = new ResizeObserver(async () => {
      await this.resize(this.app.screen.width, this.app.screen.height);
    });
    this.resizeObserver.observe(element);
  }

  public destroy() {
    this.resizeObserver?.disconnect();
    this.app.stage.removeChildren();
    this.onCleanup();
    console.log('PixiView destroyed');
  }

  protected async resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.centerX = this.width / 2.0;
    this.centerY = this.height / 2.0;
    this.onResize();
    await this.refresh();
  }


  protected async initHandlers(): Promise<any> {
  }

  protected abstract refresh(): Promise<any>;


  protected onResize(): void {
  };

  protected onCleanup(): void {
  };

}
