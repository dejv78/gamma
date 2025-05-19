import {effect, inject, Injectable, signal, WritableSignal} from "@angular/core";
import {Pigment, PIGMENTS} from "./pigments";
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

  private size: number = 0;
  private maxChromaDiameter: number = 0;

  private gamutContainer: Container<any> = new Container();
  private pigmentGamutContainer: Container<any> = new Container();
  private pigmentMarksContainer: Container<any> = new Container();

  private mode: OpMode = 'freestyle';

  private s?: Point;
  private translateBase: Ab = new Ab(0, 0);

  private gamutPoints: Ab[] = [];
  private gamut?: Graphics;
  private angleDeg: number = 0;
  private translate: Ab = new Ab(0, 0);
  private scaleX: number = 1;
  private scaleY: number = 1;

  private pigments: Pigment[] = [];
  private showPigmentGamut: boolean = false;
  private showPigmentMarks: boolean = false;
  private pigmentGamutPoints: Ab[] = [];
  private pigmentGamut?: Graphics;


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
      this.prepareGamutPoints(imageData);
      await this.generateGamut(this.gamutContainer);
    });

    combineLatest([
      toObservable(this.store.pigments),
      toObservable(this.store.showPigmentGamut),
      toObservable(this.store.showPigmentMarks),
    ]).pipe(
      debounceTime(250),
      distinct(),
    ).subscribe(async ([pigments, showPigmentGamut, showPigmentMarks]) => {
      this.pigments = pigments;
      this.showPigmentGamut = showPigmentGamut;
      this.showPigmentMarks = showPigmentMarks;
      this.preparePigmentGamutPoints();
      await this.generatePigmentGamut(this.pigmentGamutContainer);
      await this.generatePigmentMarks(this.pigmentMarksContainer);
    });
  }


  protected override async initHandlers(): Promise<any> {
    this.app.stage.eventMode = 'static';

    this.app.stage.on('wheel', async (event: FederatedWheelEvent) => {
      if (event.shiftKey) {
        this.scaleX += event.deltaY * 0.001;
      } else if (event.altKey) {
        this.scaleY += event.deltaY * 0.001;
      } else {
        event.preventDefault();
        this.angleDeg += (event.deltaY > 0) ? 7.5 : -7.5;
      }
      await this.generateGamut(this.gamutContainer!);
    });

    this.app.stage.on('pointerdown', async (event: FederatedPointerEvent) => {
      event.preventDefault();
      if (!this.s) {
        this.s = event.global.clone();
      }
    });

    this.app.stage.on('pointermove', async (event: FederatedPointerEvent) => {
      event.preventDefault();
      if (!!this.s) {
        const t: Ab = this.abDistance(this.s, event.global);
        this.translate = new Ab(this.translateBase.a + t.a, this.translateBase.b + t.b);
        await this.generateGamut(this.gamutContainer!);
      }
    });

    this.app.stage.on('pointerup', async (event: FederatedPointerEvent) => {
      event.preventDefault();
      if (!!this.s) {
        const t: Ab = this.abDistance(this.s, event.global);
        this.translate = new Ab(this.translateBase.a + t.a, this.translateBase.b + t.b);
        this.translateBase = new Ab(this.translate.a, this.translate.b);
        this.s = undefined;
        await this.generateGamut(this.gamutContainer!);
      }
    });

    return super.initHandlers();
  }


  protected override onResize() {
    this.size = Math.min(this.width, this.height);
    this.maxChromaDiameter = (this.size / 2.0) - 2 * MARGIN;
  }


  protected override async refresh(): Promise<any> {
    this.app.stage.removeChildren();
    this.generateColorWheel(this.app.stage);
    this.app.stage.addChild(this.gamutContainer);
    this.generateColorWheelLabels(this.app.stage);
    this.app.stage.addChild(this.pigmentGamutContainer);
    this.app.stage.addChild(this.pigmentMarksContainer);
    this.generateGamut(this.gamutContainer);
    this.generatePigmentGamut(this.pigmentGamutContainer);
    this.generatePigmentMarks(this.pigmentMarksContainer);
  }


  private prepareGamutPoints(imageData: ImageData) {
    switch (this.mode) {
      case 'freestyle':
        this.gamutPoints = [];
        break;

      case 'pigment-based':
        this.gamutPoints = [];
        break;

      case 'image-based':
        if ((imageData.width > 0) && (imageData.height > 0) && (!!imageData.data) && (imageData.data.length > 0)) {
          const step: number = Math.floor(imageData.width * imageData.height / 4000) * 4;
          const p: Ab[] = [];
          const pixels = imageData.data;
          for (let i = 0; i < (pixels.length); i += step) {
            const lab = rgbToOklab(pixels[i], pixels[i + 1], pixels[i + 2]);
            p.push(new Ab(lab.a, lab.b));
          }
          this.gamutPoints = makeHull(p);
        }
        break;
    }
  }


  private preparePigmentGamutPoints() {
    this.pigmentGamutPoints = makeHull(this.pigments.map(p => new Ab(p.ab.a, p.ab.b)));
  }


  private abDistance(p1: Point, p2: Point): Ab {
    const a: number = normalizeDistance(p1.x, p2.x, this.maxChromaDiameter, MAX_CHROMA)
    const b: number = normalizeDistance(p1.y, p2.y, -this.maxChromaDiameter, MAX_CHROMA)
    return new Ab(a, b);
  }


  private generateColorWheel(stage: any): any {
    const segmentSize = this.maxChromaDiameter / (SATURATION_SEGMENT_COUNT + 1);
    const saturationStepOKLCh =MAX_CHROMA / (SATURATION_SEGMENT_COUNT + 0.5);
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


  private generateColorWheelLabels(stage: any): any {
    let hue: number = 0;
    const angle = (Math.PI * 2) / HUE_SEGMENT_COUNT;
    let a: number = 0 - angle / 2;

    for (let j = 0; j <= HUE_SEGMENT_COUNT - 1; j++) {
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
  }


  private generateGamut(stage: Container<any>): any {
    if (!!this.gamut) {
      stage.removeChild(this.gamut);
      this.gamut = undefined;
    }
    if (this.gamutPoints.length > 0) {
      const polygon: any = new Graphics();
      polygon.circle(this.centerX, this.centerY, this.maxChromaDiameter * 3.0);
      polygon.fill('#000000CC');
      drawConvexHull(this.gamutPoints, this.denormalizeTransformedCoords.bind(this), stage, polygon);
      polygon.cut();

      this.gamut = polygon;
      stage.addChild(polygon);
    }
  }


  private generatePigmentGamut(stage: Container<any>): any {
    if (!!this.pigmentGamut) {
      stage.removeChild(this.pigmentGamut);
      this.pigmentGamut = undefined;
    }
    if (this.showPigmentGamut && this.pigmentGamutPoints.length > 0) {
      const polygon: any = new Graphics();
      drawConvexHull(this.pigmentGamutPoints, this.denormalizeCoords.bind(this), stage, polygon);
      polygon.stroke({width: STROKE_WIDTH, color: 'grey'});
      this.pigmentGamut = polygon;
      stage.addChild(polygon);
    }
  }


  private generatePigmentMarks(stage: any): any {
    stage.removeChildren();
    if (this.showPigmentMarks) {
      for (const pigment of this.pigments) {
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
          text: `${pigment.code}\n${pigment.name}`, style: {
            fontSize: 15,
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
        text.y = y+5;
        text.anchor.x = 0.5;
        stage.addChild(text);
      }
    }
  }


  private denormalizeTransformedCoords(ab: readonly Ab[]): PointData[] {
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


  private denormalizeCoords(ab: readonly Ab[]): PointData[] {
    const result: PointData[] = [];

    for (const p of ab) {
      result.push({x: this.xCoord(p), y: this.yCoord(p)});
    }
    return result;
  }


  private xCoord(ab: Ab): number {
    return denormalize(ab.a, this.centerX, this.maxChromaDiameter, MAX_CHROMA)
  }


  private yCoord(ab: Ab): number {
    return denormalize(ab.b, this.centerY, -this.maxChromaDiameter, MAX_CHROMA)
  }
}
