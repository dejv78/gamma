import {effect, inject, Injectable, signal, WritableSignal} from "@angular/core";
import {Assets, Sprite, Texture, Container, GetPixelsOutput} from "pixi.js";
import {PixiView} from "../common/pixi-view";
import {AppStore} from "../store/app-store";
import {GamutFilter} from "./filters/filter-gamut";

@Injectable({providedIn: 'root'})
export class Image
  extends PixiView {

  public store = inject(AppStore);

  public filterGrayscale: WritableSignal<boolean> = signal(false);
  public pixels?: Uint8ClampedArray;
  public w: number = 0;
  public h: number = 0;

  private image?: Sprite;
  private gamutFilter = new GamutFilter();

  constructor() {
    super();

    // effect(() => {
    //   const gs = this.filterGrayscale();
    //   if (!!this.image) {
    //     this.image.filters = gs ? [grayscaleFilter] : [];
    //   }
    // });

    effect(() => {
      const m = this.store.gamutTransformMatrix();
      this.gamutFilter.A = m.a;
      this.gamutFilter.C = m.c;
      this.gamutFilter.Tx = m.tx;
      this.gamutFilter.B = m.b;
      this.gamutFilter.D = m.d;
      this.gamutFilter.Ty = m.ty;
      //console.log(`transform A=${this.gamutFilter.A}, C=${this.gamutFilter.C}, Tx=${this.gamutFilter.Tx}, B=${this.gamutFilter.B}, D=${this.gamutFilter.D}, Ty=${this.gamutFilter.Ty}`);
    });
  }

  protected override async refresh(): Promise<any> {
    await this.generateImage(this.app.stage);
  }


  private async generateImage(stage: Container<any>): Promise<any> {
    stage.removeChildren();
    //const texture: Texture = await Assets.load('/redgreen.jpg');
    const texture: Texture = await Assets.load('/tree.jpg');
    //const texture: Texture = await Assets.load('/bridge.png');
    //const texture: Texture = await Assets.load('/wheel.png');
    this.image = Sprite.from(texture);
    const o: GetPixelsOutput = this.app.renderer.extract.pixels(this.image);
    this.pixels = o.pixels;
    this.w = o.width;
    this.h = o.height;
    this.store.setImageData({width: o.width, height: o.height, data: o.pixels});
    this.image.filters = [this.gamutFilter];
    this.image.anchor.set(0.5);
    const viewportRatio: number = this.width / this.height;
    const imageRatio: number = texture.width / texture.height;
    this.image.x = this.centerX;
    this.image.y = this.centerY;
    if (imageRatio > viewportRatio) {
      this.image.width = this.width;
      this.image.height = this.width / imageRatio;
    } else {
      this.image.height = this.height;
      this.image.width = this.height * imageRatio;
    }
    stage.addChild(this.image);
  }

}
