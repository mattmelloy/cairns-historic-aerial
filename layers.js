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
      "timelineLabel": "1962 Beaches",
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
      "timelineLabel": "1965",
      "year": 1965,
      "url": "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/CairnsProject1965/{z}/{x}/{y}.webp",
      "scheme": "xyz",
      "minZoom": 10,
      "maxNativeZoom": 19,
      "maxZoom": 21,
      "bounds": [
        [
          -17.0237,
          145.5906
        ],
        [
          -16.7432,
          145.8827
        ]
      ],
      "attribution": "Cairns 1965 &mdash; unified GCP-aligned mosaic (QAP1656 + QAP1774 + QAP1655/1777-023), tone-matched &mdash; Queensland Government QImagery"
    },
    {
      "id": "cookhwy1965",
      "name": "1965 Cook Hwy",
      "year": 1965,
      "url": "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/cookhighway1965/{z}/{x}/{y}.webp",
      "scheme": "xyz",
      "minZoom": 11,
      "maxNativeZoom": 20,
      "bounds": [
        [
          -16.9400661,
          145.6605731
        ],
        [
          -16.7661997,
          145.7896192
        ]
      ],
      "attribution": "Cook Highway 1965 &mdash; Queensland Government QImagery"
    },
    {
      "id": "cairns1972",
      "name": "Cairns 1972",
      "year": 1972,
      "url": "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/Cairns1972/{z}/{x}/{y}.webp",
      "scheme": "xyz",
      "minZoom": 10,
      "maxNativeZoom": 19,
      "bounds": [
        [
          -17.02921196640138,
          145.6244659423828
        ],
        [
          -16.705916989193067,
          145.8489990234375
        ]
      ],
      "attribution": "Cairns 1972 &mdash; Queensland Government QImagery"
    },
    {
      "id": "cairns1977",
      "name": "Cairns 1977",
      "timelineLabel": "1977",
      "year": 1977,
      "url": "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/cairns1977/{z}/{x}/{y}.webp",
      "scheme": "xyz",
      "minZoom": 10,
      "maxNativeZoom": 19,
      "bounds": [
        [
          -17.02921196640138,
          145.6244659423828
        ],
        [
          -16.705916989193067,
          145.8489990234375
        ]
      ],
      "attribution": "Cairns 1977 &mdash; Queensland Government QImagery"
    },
    {
      "id": "cairns1977-webodm-review",
      "name": "Cairns 1977 (WebODM review)",
      "timelineLabel": "1977 review",
      "year": 1977,
      "url": "http://127.0.0.1:8139/cairns1977/aws_final_20260720/tiles_review_rgba_z10_16/{z}/{x}/{y}.webp",
      "scheme": "xyz",
      "minZoom": 10,
      "maxNativeZoom": 16,
      "maxZoom": 20,
      "showBoundaryInQuadrants": true,
      "showBoundaryByDefault": true,
      "boundaryColor": "#ef4444",
      "bounds": [
        [
          -17.0067222,
          145.6689691
        ],
        [
          -16.7543896,
          145.785739
        ]
      ],
      "attribution": "Cairns 1977 &mdash; local WebODM production review (16 cm source orthophoto; review tiles to zoom 16)"
    },
    {
      "id": "cairns1977-local-cohesive-v3",
      "name": "Cairns 1977 (earlier local coverage)",
      "timelineLabel": "1977 local",
      "year": 1977,
      "url": "http://127.0.0.1:8139/cairns1977/full_browser_exact_20260717/tiles/cairns1977_full_browser_exact_cohesive_v3_z16/{z}/{x}/{y}.webp",
      "scheme": "xyz",
      "minZoom": 10,
      "maxNativeZoom": 16,
      "maxZoom": 20,
      "showBoundaryInQuadrants": true,
      "boundaryColor": "#06b6d4",
      "bounds": [
        [
          -17.0200202,
          145.6512451
        ],
        [
          -16.7203851,
          145.7885742
        ]
      ],
      "attribution": "Cairns 1977 &mdash; earlier local cohesive-v3 coverage comparison (1,042 aligned source frames; review tiles to zoom 16)"
    }
  ]
};
