import {Filter, GlProgram} from "pixi.js";
import {vertex} from "./vertex-shader";

const fragment =
  `
    in vec2 vTextureCoord;
    in vec4 vColor;

    uniform sampler2D uTexture;
    uniform float uTime;

    void main(void)
    {
        vec2 uvs = vTextureCoord.xy;
        vec4 fg = texture2D(uTexture, vTextureCoord);
        float gray = dot(fg.rgb, vec3(0.299, 0.587, 0.114));
        fg.r = gray;
        fg.g = gray;
        fg.b = gray;
        gl_FragColor = fg;
    }
`;

export const grayscaleFilter: Filter = new Filter({
  glProgram: GlProgram.from({
    fragment,
    vertex,
  }),
  resources: {
    timeUniforms: {
      uTime: { value: 0.0, type: 'f32' },
    },
  }
});
