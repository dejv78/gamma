import {ImageData, OpMode} from "../model/app.model";
import {patchState, signalStore, withMethods, withState} from "@ngrx/signals";
import {Matrix} from "pixi.js";

export type AppStoreState = {
  mode: OpMode;
  imageData: ImageData;
  gamutTransformMatrix: Matrix;
}

const initialState: AppStoreState = {
  mode: 'image-based',
  imageData: {
    width: 0,
    height: 0,
  },
  gamutTransformMatrix: new Matrix()
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
    })
  )
);
