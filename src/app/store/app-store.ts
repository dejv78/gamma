import {ImageData, OpMode} from "../model/app.model";
import {patchState, signalStore, withMethods, withState} from "@ngrx/signals";
import {Matrix} from "pixi.js";
import {Pigment, PIGMENTS} from "../color-wheel/pigments";

export type AppStoreState = {
  mode: OpMode;
  imageData: ImageData;
  gamutTransformMatrix: Matrix;
  pigments: Pigment[];
  showPigmentGamut: boolean;
  showPigmentMarks: boolean;
}

const initialState: AppStoreState = {
  mode: 'image-based',
  imageData: {
    width: 0,
    height: 0,
  },
  gamutTransformMatrix: new Matrix(),
  pigments: PIGMENTS,
  showPigmentGamut: false,
  showPigmentMarks: false,
}

export const AppStore = signalStore(
  withState(initialState),
  withMethods((store) => ({
      setMode: (mode: OpMode) => {
        patchState(store, (state) => ({
          ...state,
          mode
        }));
      },

      setImageData: (imageData: ImageData) => {
        patchState(store, (state) => ({
          ...state,
          imageData
        }));
      },

      clearImageData: () => {
        patchState(store, (state) => ({
          ...state,
          imageData: {
            width: 0,
            height: 0,
          }
        }));
      },

      setGamutTransformMatrix: (m: Matrix) => {
        patchState(store, (state) => ({
          ...state,
          gamutTransformMatrix: m
        }));
      },

    setShowPigmentGamut: (showPigmentGamut: boolean) => {
      patchState(store, (state) => ({
        ...state,
        showPigmentGamut
      }));
    },

    setShowPigmentMarks: (showPigmentMarks: boolean) => {
      patchState(store, (state) => ({
        ...state,
        showPigmentMarks
      }));
    }

  }))
);
