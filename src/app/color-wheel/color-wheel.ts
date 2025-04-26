import {inject, Injectable, signal, WritableSignal} from "@angular/core";
import {PIGMENTS} from "./pigments";
import {Container, DEG_TO_RAD, FederatedPointerEvent, FederatedWheelEvent, Graphics, Point, PointData, RAD_TO_DEG, Text, Transform} from "pixi.js";
import {PixiView} from "../common/pixi-view";
import {css, oklch} from "@thi.ng/color";
import {drawConvexHull, makeHull} from "../utils/convex-hull";
import {denormalize, normalizeDistance} from "../utils/coords";
import {AppStore} from "../store/app-store";
import {combineLatest, debounceTime, distinct} from "rxjs";
import {toObservable} from "@angular/core/rxjs-interop";
import {Ab, ImageData, OpMode} from "../model/app.model";
import {rgbToOklab} from "../utils/oklab";

const MARGIN: number = 20;
const STROKE_WIDTH: number = 2;
const SATURATION_SEGMENT_COUNT: number = 4;
const HUE_SEGMENT_COUNT: number = 24;
const MAX_CHROMA: number = 0.25;

@Injectable({providedIn: 'root'})
export class ColorWheel
  extends PixiView {
  public store = inject(AppStore);

  public mapImageGamut: WritableSignal<boolean> = signal(false);

  private size: number = 0;
  private maxChromaDiameter: number = 0;

  private s?: Point;
  private translateBase: Ab = new Ab(0, 0);

  private gamutPoints: Ab[] = [];
  private gamut?: Graphics;
  private angleDeg: number = 0;
  private translate: Ab = new Ab(0, 0);
  private scaleX: number = 1;
  private scaleY: number = 1;

  private mode: OpMode = 'freestyle';
  private imageData: ImageData = {width: 0, height: 0};

  // private testRgb: any = {r: 0, g: 0, b: 0};
  // private testAb?: Graphics;
  // private testAbPoint: Ab = new Ab(0, 0, 0);
  // private testRgbT: any = {r: 0, g: 0, b: 0};
  // private testAbT?: Graphics;
  // private testAbTPoint: Ab = new Ab(0, 0, 0);

  constructor() {
    super();

    combineLatest([
      toObservable(this.store.mode),
      toObservable(this.store.imageData)
    ]).pipe(
      debounceTime(250),
      distinct(),
    ).subscribe(async ([mode, imageData]) => {
      this.angleDeg = 0;
      this.mode = mode;
      this.imageData = imageData;
      this.prepareGamutPoints();
      await this.generateGamut(this.app.stage);
    });
    // effect(() => {
    //   const m = this.store.gamutTransformMatrix();
    //   //console.log(`From L=${this.testAbPoint.l} a=${this.testAbPoint.a} b=${this.testAbPoint.b}`);
    //   //console.log(`From R=${this.testRgb.r} G=${this.testRgb.g} B=${this.testRgb.b}`);
    //   const ta: number = this.testAbPoint.a * m.a + this.testAbPoint.b * m.c + m.tx;
    //   const tb: number = this.testAbPoint.a * m.b + this.testAbPoint.b * m.d + m.ty;
    //   this.testAbTPoint = new Ab(ta, tb, this.testAbPoint.l);
    //   //console.log(`To L=${this.testAbTPoint.l} a=${this.testAbTPoint.a} b=${this.testAbTPoint.b}`);
    //   this.testRgbT = oklabToSRGB(this.testAbTPoint.l!, this.testAbTPoint.a, this.testAbTPoint.b);
    //   //console.log(`From R=${this.testRgbT.r} G=${this.testRgbT.g} B=${this.testRgbT.b}`);
    //   this.generateTestPoint(this.app.stage);
    // })
  }

  protected override async initHandlers(): Promise<any> {
    this.app.stage.eventMode = 'static';

    this.app.stage.on('wheel', (event: FederatedWheelEvent) => {
      if (event.shiftKey) {
        this.scaleX += event.deltaY * 0.001;
      } else if (event.ctrlKey) {
        this.scaleY += event.deltaY * 0.001;
      } else {
        event.preventDefault();
        this.angleDeg += (event.deltaY > 0) ? 7.5 : -7.5;
      }
      this.generateGamut(this.app.stage);
    });
    this.app.stage.on('pointerdown', (event: FederatedPointerEvent) => {
      event.preventDefault();
      if (!this.s) {
        this.s = event.global.clone();
      }
    });
    this.app.stage.on('pointermove', (event: FederatedPointerEvent) => {
      event.preventDefault();
      if (!!this.s) {
        const t: Ab = this.abDistance(this.s, event.global);
        this.translate = new Ab(this.translateBase.a + t.a, this.translateBase.b + t.b);
        this.generateGamut(this.app.stage);
      }
    });
    this.app.stage.on('pointerup', (event: FederatedPointerEvent) => {
      event.preventDefault();
      if (!!this.s) {
        const t: Ab = this.abDistance(this.s, event.global);
        this.translate = new Ab(this.translateBase.a + t.a, this.translateBase.b + t.b);
        this.translateBase = new Ab(this.translate.a, this.translate.b);
        this.s = undefined;
        this.generateGamut(this.app.stage);
      }
    });
    return super.initHandlers();
  }


  protected override onResize() {
    this.size = Math.min(this.width, this.height);
    this.maxChromaDiameter = (this.size / 2.0) - 2 * MARGIN;
  }


  protected override async refresh(): Promise<any> {
    this.generateColorWheel(this.app.stage);
    this.generatePigmentSpots(this.app.stage);
  }


  private generateColorWheel(stage: any): any {
    stage.removeChildren();
    const segmentSize = this.maxChromaDiameter / (SATURATION_SEGMENT_COUNT + 1);
    const saturationStepOKLCh = MAX_CHROMA / SATURATION_SEGMENT_COUNT;
    const angle = (Math.PI * 2) / HUE_SEGMENT_COUNT;
    let a: number = 0 - angle / 2;
    let hue: number = 0;
    for (let i = 0; i < HUE_SEGMENT_COUNT; i++) {
      let outerSegment: any = undefined;

      for (let j = 0; j <= SATURATION_SEGMENT_COUNT; j++) {
        const fill: string = css(oklch(0.7, MAX_CHROMA - (j * saturationStepOKLCh), hue / 360.0));
        const segment: any = new Graphics();
        segment.moveTo(0, 0);
        segment.arc(0, 0, this.maxChromaDiameter - (segmentSize * j), a, a + angle, false);
        segment.fill(fill);
        segment.stroke({width: STROKE_WIDTH, color: 'black'});
        segment.x = this.centerX;
        segment.y = this.centerY;
        stage.addChild(segment);
        if (!outerSegment) {
          outerSegment = segment;
        }
      }
      const degText = new Text({
        text: `${Math.round(hue)}°`, style: {
          fontSize: 15,
          fontWeight: 'bold',
          fill: 'white',
        }
      });
      const na: number = -hue * DEG_TO_RAD;
      degText.x = this.centerX + (this.maxChromaDiameter + 5) * Math.cos(na);
      degText.y = this.centerY + (this.maxChromaDiameter + 5) * Math.sin(na);
      degText.rotation = na;
      stage.addChild(degText);

      a -= angle;
      if (a < 0) {
        a += Math.PI * 2;
      }
      hue += angle * RAD_TO_DEG;
      if (hue > 360) {
        hue -= 360;
      }
    }
    const line: any = new Graphics();
    line.lineTo(0, -this.maxChromaDiameter);
    line.stroke({width: STROKE_WIDTH, color: 'black'});
    line.rotation = -angle / 2;
    line.x = this.centerX;
    line.y = this.centerY;
    stage.addChild(line);
  }


  private generatePigmentSpots(stage: any): any {
    for (const pigment of PIGMENTS) {
      if (pigment.hideByDefault) {
        continue;
      }
      const x: number = this.xCoord(pigment.ab);
      const y: number = this.yCoord(pigment.ab);
      const dot: any = new Graphics();
      dot.circle(x, y, 5);
      dot.fill(css(oklch(pigment.l, pigment.ch.c, pigment.ch.h / 360.0)));
      dot.stroke({width: 1, color: 'black'});
      stage.addChild(dot);

      const text = new Text({
        text: pigment.code, style: {
          fontSize: 13,
          fontWeight: 'bold',
          fill: 'white',
          align: 'center',
          dropShadow: {
            color: '#000000',
            blur: 4,
            angle: Math.PI / 6,
            distance: 6,
          },
        }
      });
      text.x = x;
      text.y = y;
      stage.addChild(text);
    }
  }

  private generateGamut(stage: Container<any>): any {
    if (!!this.gamut) {
      stage.removeChild(this.gamut);
      this.gamut = undefined;
    }
    if (this.gamutPoints.length > 0) {
      const polygon: any = new Graphics();
      polygon.circle(this.centerX, this.centerY, this.maxChromaDiameter);
      polygon.fill('#00000077');
      drawConvexHull(this.gamutPoints, this.denormalizeCoords.bind(this), stage, polygon);
      polygon.cut();

      this.gamut = polygon;
      stage.addChild(polygon);
    }
  }

  // private generateTestPoint(stage: Container<any>): any {
  //   if (!!this.testAb) {
  //     stage.removeChild(this.testAb);
  //     this.testAb = undefined;
  //   }
  //   if (!!this.testAbPoint) {
  //     const x: number = this.xCoord(this.testAbPoint);
  //     const y: number = this.yCoord(this.testAbPoint);
  //     const dot: any = new Graphics();
  //     dot.circle(x, y, 5);
  //     dot.fill('red');
  //     dot.stroke({width: 1, color: 'black'});
  //     stage.addChild(dot);
  //     this.testAb = dot;
  //   }
  //
  //   if (!!this.testAbT) {
  //     stage.removeChild(this.testAbT);
  //     this.testAbT = undefined;
  //   }
  //   if (!!this.testAbTPoint) {
  //     const c = oklabToSRGB(this.testAbTPoint.l!, this.testAbTPoint.a, this.testAbTPoint.b);
  //     const x: number = this.xCoord(this.testAbTPoint);
  //     const y: number = this.yCoord(this.testAbTPoint);
  //     const dot: Graphics = new Graphics();
  //     dot.circle(x, y, 5);
  //     dot.fill({r: c.r, g: c.g, b: c.b});
  //     dot.stroke({width: 1, color: 'black'});
  //     stage.addChild(dot);
  //     this.testAbT = dot;
  //   }
  // }


  private prepareGamutPoints() {
    switch (this.mode) {
      case 'freestyle':
        this.gamutPoints = [];
        break;

      case 'pigment-based':
        this.gamutPoints = makeHull(PIGMENTS.map(p => new Ab(p.ab.a, p.ab.b)));
        break;

      case 'image-based':
        if ((this.imageData.width > 0) && (this.imageData.height > 0) && (!!this.imageData.data) && (this.imageData.data.length > 0)) {
          const step: number = Math.floor(this.imageData.width * this.imageData.height / 4000) * 4;
          //const step: number = 8;
          const p: Ab[] = [];
          const pixels = this.imageData.data;
          const startTime = performance.now();
          for (let i = 0; i < (pixels.length); i += step) {
            const lab = rgbToOklab(pixels[i], pixels[i + 1], pixels[i + 2]);
            // if (i === 0) {
            //   this.testRgb = {r: pixels[i], g: pixels[i + 1], b: pixels[i + 2]};
            //   this.testAbPoint = new Ab(lab.a, lab.b, lab.L);
            // }
            p.push(new Ab(lab.a, lab.b));
          }
          const endTime = performance.now();
          console.log(`Gamut points generation took ${endTime - startTime} ms`);
          this.gamutPoints = makeHull(p);
        }
        break;
    }
  }


  private denormalizeCoords(ab: readonly Ab[]): PointData[] {
    const result: PointData[] = [];

    const transform = new Transform();

    const minX: number = Math.min(...ab.map(p => p.a));
    const maxX: number = Math.max(...ab.map(p => p.a));
    const minY: number = Math.min(...ab.map(p => p.b));
    const maxY: number = Math.max(...ab.map(p => p.b));
    const center: Ab = new Ab(minX + (maxX - minX) / 2.0, minY + (maxY - minY) / 2.0);
    const cX = center.a;
    const cY = center.b;
    transform.rotation = this.angleDeg * DEG_TO_RAD;
    transform.scale.x = this.scaleX;
    transform.scale.y = this.scaleY;
    transform.pivot.set(cX, cY);
    transform.position.set(cX + this.translate.a, cY + this.translate.b);

    this.store.setGamutTransformMatrix(transform.matrix);

    for (const p of ab) {
      const rotated: Ab = p.transform(transform);
      result.push({x: this.xCoord(rotated), y: this.yCoord(rotated)});
    }
    return result;
  }


  private xCoord(ab: Ab): number {
    return denormalize(ab.a, this.centerX, this.maxChromaDiameter, MAX_CHROMA)
  }


  private yCoord(ab: Ab): number {
    return denormalize(ab.b, this.centerY, -this.maxChromaDiameter, MAX_CHROMA)
  }

  private abDistance(p1: Point, p2: Point): Ab {
    const a: number = normalizeDistance(p1.x, p2.x, this.maxChromaDiameter, MAX_CHROMA)
    const b: number = normalizeDistance(p1.y, p2.y, -this.maxChromaDiameter, MAX_CHROMA)
    //console.log(`p1x=${p1.x} p2x=${p2.x} a=${a}  p1y=${p1.y} p2y=${p2.y} b=${b}`);
    return new Ab(a, b);
  }

}
