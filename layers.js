// Map configuration / layer manifest. Loaded with a plain <script> tag so the
// site works from the filesystem (file://) as well as over HTTP. Edit by hand or
// let pipeline.py rewrite it when you process new imagery.
window.MAP_CONFIG = {
  "defaultCenter": [
    -16.9203,
    145.771
  ],
  "defaultZoom": 13,
  "layers": [
    {
      "id": "cairns1952",
      "name": "Cairns 1952",
      "year": 1952,
      "url": "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/Cairns52/{z}/{x}/{y}.webp",
      "scheme": "xyz",
      "minZoom": 10,
      "maxNativeZoom": 20,
      "bounds": [
        [
          -16.9989471,
          145.6755294
        ],
        [
          -16.8234424,
          145.8098327
        ]
      ],
      "attribution": "Cairns 1952 &mdash; Queensland Government QImagery"
    },
    {
      "id": "cairnsbeaches1962",
      "name": "Cairns Beaches 1962",
      "year": 1962,
      "url": "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/cairnsbeaches1962/{z}/{x}/{y}.png",
      "scheme": "tms",
      "minZoom": 10,
      "maxNativeZoom": 21,
      "bounds": [
        [
          -16.89409290709009,
          145.68171895315905
        ],
        [
          -16.76526161509227,
          145.7922864573357
        ]
      ],
      "attribution": "Cairns Beaches 1962 &mdash; Queensland Government QImagery"
    },
    {
      "id": "cairns65",
      "name": "Cairns 1965 Hi-Res",
      "year": 1965,
      "url": "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/cairns65/{z}/{x}/{y}.png",
      "scheme": "tms",
      "minZoom": 10,
      "maxNativeZoom": 20,
      "bounds": [
        [
          -16.94169617690731,
          145.6614068270771
        ],
        [
          -16.76180493336028,
          145.81124445216753
        ]
      ],
      "attribution": "Cairns 1965 &mdash; Queensland Government QImagery"
    },
    {
      "id": "cookhwy1965",
      "name": "1965 Cook Hwy",
      "year": 1965,
      "url": "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/cookhwy65/{z}/{x}/{y}.webp",
      "scheme": "xyz",
      "minZoom": 11,
      "maxNativeZoom": 20,
      "bounds": [
        [
          -16.9464697,
          145.6292725
        ],
        [
          -16.7572079,
          145.8270264
        ]
      ],
      "attribution": "Cook Highway 1965 &mdash; Queensland Government QImagery"
    }
  ]
};
