import {ArrayFixed, Filter, FilterOptions, GlProgram, UniformGroup} from "pixi.js";
import {vertex} from "./vertex-shader";

const fragment =  `
in vec2 vTextureCoord;
in vec4 vColor;

uniform sampler2D uTexture;
uniform float uA;
uniform float uC;
uniform float uTx;
uniform float uB;
uniform float uD;
uniform float uTy;

float gammaToLinear (float c) {
    return (c >= 0.04045)
        ? pow((c + 0.055) / 1.055, 2.4)
        : c / 12.92;
}

float linearToGamma (float c) {
    return (c >= 0.0031308)
        ? 1.055 * pow(c, 1.0 / 2.4) - 0.055
        : 12.92 * c;
}

vec3 rgbToOklab(vec3 rgb) {
    float r = gammaToLinear(rgb.x);
    float g = gammaToLinear(rgb.y);
    float b = gammaToLinear(rgb.z);

    float l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
    float m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
    float s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

    float c = 1.0 / 3.0;
    l = pow(l, c);
    m = pow(m, c);
    s = pow(s, c);

    return vec3(
      l * 0.2104542553 + m * 0.7936177850 + s * -0.0040720468,
      l * 1.9779984951 + m * -2.4285922050 + s * 0.4505937099,
      l * 0.0259040371 + m * 0.7827717662 + s * -0.8086757660
    );
}

vec3 oklabToSRGB(vec3 lab) {
    float l = lab.x + lab.y * 0.3963377774 + lab.z * 0.2158037573;
    float m = lab.x + lab.y * -0.1055613458 + lab.z * -0.0638541728;
    float s = lab.x + lab.y * -0.0894841775 + lab.z * -1.2914855480;

    l = pow(l, 3.0);
    m = pow(m, 3.0);
    s = pow(s, 3.0);

    float r = l * +4.0767416621 + m * -3.3077115913 + s * 0.2309699292;
    float g = l * -1.2684380046 + m * 2.6097574011 + s * -0.3413193965;
    float b = l * -0.0041960863 + m * -0.7034186147 + s * 1.7076147010;

    r = linearToGamma(r);
    g = linearToGamma(g);
    b = linearToGamma(b);

    r = clamp(r, 0.0, 1.0);
    g = clamp(g, 0.0, 1.0);
    b = clamp(b, 0.0, 1.0);

    return vec3(r, g, b);
}


void main(void)
{
    vec2 uvs = vTextureCoord.xy;
    vec4 fg = texture2D(uTexture, vTextureCoord);
    vec3 oklab = rgbToOklab(fg.rgb);
//    vec3 oklab = rgbToOklab(vec3(1, 0, 0));
    float a = oklab.y * uA + oklab.z * uC + uTx;
    float b = oklab.y * uB + oklab.z * uD + uTy;
    oklab.y = a;
    oklab.z = b;
    vec3 rgb = oklabToSRGB(oklab);
    gl_FragColor = vec4(rgb, fg.a);
}
`;

export type ColorMatrix = ArrayFixed<number, 9>;

export class GamutFilter extends Filter {
  constructor (options: FilterOptions = {}) {
    const gamutUniforms = new UniformGroup({
      uA: {
        value: 1,
        type: 'f32',
      },
      uC: {
        value: 0,
        type: 'f32',
      },
      uTx: {
        value: 0,
        type: 'f32',
      },
      uB: {
        value: 0,
        type: 'f32',
      },
      uD: {
        value: 1,
        type: 'f32',
      },
      uTy: {
        value: 0,
        type: 'f32',
      },
    });

    const glProgram = GlProgram.from({
      vertex,
      fragment,
      name: 'gamut-filter'
    });

    super({
      ...options,
      gpuProgram: undefined,
      glProgram,
      resources: {
        gamutUniforms
      },
    });

  }

  get A(): number {
    return this.resources['gamutUniforms'].uniforms.uA;
  }

  set A(value: number) {
    this.resources['gamutUniforms'].uniforms.uA = value;
  }

  get C(): number {
    return this.resources['gamutUniforms'].uniforms.uC;
  }

  set C(value: number) {
    this.resources['gamutUniforms'].uniforms.uC = value;
  }

  get Tx(): number {
    return this.resources['gamutUniforms'].uniforms.uTx;
  }

  set Tx(value: number) {
    this.resources['gamutUniforms'].uniforms.uTx = value;
  }

  get B(): number {
    return this.resources['gamutUniforms'].uniforms.uB;
  }

  set B(value: number) {
    this.resources['gamutUniforms'].uniforms.uB = value;
  }

  get D(): number {
    return this.resources['gamutUniforms'].uniforms.uD;
  }

  set D(value: number) {
    this.resources['gamutUniforms'].uniforms.uD = value;
  }

  get Ty(): number {
    return this.resources['gamutUniforms'].uniforms.uTy;
  }

  set Ty(value: number) {
    this.resources['gamutUniforms'].uniforms.uTy = value;
  }

}



