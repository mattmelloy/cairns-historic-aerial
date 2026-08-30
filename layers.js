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
      "id": "tinaroo1949",
      "name": "Lake Tinaroo 1949",
      "timelineLabel": "Lake Tinaroo 1949",
      "year": 1949,
      "url": "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/Tinaroo1949/{z}/{x}/{y}.webp",
      "scheme": "xyz",
      "minZoom": 10,
      "maxNativeZoom": 19,
      "maxZoom": 21,
      "bounds": [
        [
          -17.2757953,
          145.4940544
        ],
        [
          -17.1248666,
          145.6419394
        ]
      ],
      "referenceOverlayUrl": "tinaroo/reference/lake_tinaroo_and_dam_wall.geojson",
      "referenceOverlayLabel": "Show Lake Tinaroo reservoir & dam wall",
      "attribution": "Lake Tinaroo 1949 aerial imagery &mdash; Queensland Government QImagery; Lake Tinaroo and dam wall outline &copy; State of Queensland"
    },
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
      "url": "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/cairns77/{z}/{x}/{y}.webp",
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
      "id": "cairns1978",
      "name": "Cairns 1978",
      "timelineLabel": "1978",
      "year": 1978,
      "url": "https://tiles.melloy.bid/tiles/cairns1978_aws_native_affine_z20_q95/{z}/{x}/{y}.webp",
      "scheme": "xyz",
      "minZoom": 10,
      "maxNativeZoom": 20,
      "bounds": [
        [
          -16.9523228,
          145.655892
        ],
        [
          -16.7278504,
          145.8184037
        ]
      ],
      "attribution": "Cairns 1978 &mdash; GCP affine-aligned to Esri World Imagery &mdash; Queensland Government QImagery"
    },
    {
      "id": "cairns1983",
      "name": "Cairns 1983",
      "timelineLabel": "1983",
      "year": 1983,
      "url": "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/cairns83/{z}/{x}/{y}.webp",
      "scheme": "xyz",
      "minZoom": 10,
      "maxNativeZoom": 20,
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
      "attribution": "Cairns 1983 &mdash; Queensland Government QImagery"
    },
    {
      "id": "cairns1987beaches",
      "name": "1987 Beaches",
      "timelineLabel": "1987 Beaches",
      "year": 1987,
      "tileUrls": [
        "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/cairns87beachesDoubleIsland/{z}/{x}/{y}.webp",
        "https://filedn.com/lnwtRrhS2tTy2K4EooXWFnR/tiles/historic/cairns87beachesmain/{z}/{x}/{y}.webp"
      ],
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
      "attribution": "1987 Beaches &mdash; Queensland Government QImagery"
    }
  ]
};
