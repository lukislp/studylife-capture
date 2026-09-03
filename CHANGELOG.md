## [1.5.5](https://github.com/lukislp/studylife-capture/compare/v1.5.4...v1.5.5) (2026-09-03)


### Bug Fixes

* **ci:** add Dependabot for github-actions, npm ([74fa8bb](https://github.com/lukislp/studylife-capture/commit/74fa8bbe169eddd52d84645fe0315fea7a0c8cf9))

## [1.5.4](https://github.com/lukislp/studylife-capture/compare/v1.5.3...v1.5.4) (2026-08-27)


### Bug Fixes

* harden release chain against [skip ci] races and add unit test suite ([ef500eb](https://github.com/lukislp/studylife-capture/commit/ef500ebb597776f136b866b17c990fb06176f52f))
* retrigger release chain (merge push of [#25](https://github.com/lukislp/studylife-capture/issues/25) spawned no workflow run) ([df30eb7](https://github.com/lukislp/studylife-capture/commit/df30eb708074d0b2f6d2415e1b62183cfb33c05a))

## [1.5.3](https://github.com/lukislp/studylife-capture/compare/v1.5.2...v1.5.3) (2026-08-27)


### Bug Fixes

* privacy policy no longer implies an in-popup manual key option ([10b7361](https://github.com/lukislp/studylife-capture/commit/10b73617c90b8fe3b9234adf005424b39c37ecb5))

## [1.5.2](https://github.com/lukislp/studylife-capture/compare/v1.5.1...v1.5.2) (2026-08-27)


### Bug Fixes

* restore draft URL after a denied prompt and drop stale manual-path texts ([4394be1](https://github.com/lukislp/studylife-capture/commit/4394be102ad316bc2ba291d107edb3bcecbfb794))

## [1.5.1](https://github.com/lukislp/studylife-capture/compare/v1.5.0...v1.5.1) (2026-08-27)


### Bug Fixes

* say what the connect button does once already connected ([8eb451c](https://github.com/lukislp/studylife-capture/commit/8eb451ca27a79d1b31b485c99e89148009810800))

# [1.5.0](https://github.com/lukislp/studylife-capture/compare/v1.4.2...v1.5.0) (2026-08-27)


### Features

* drop the manual api-key entry - consent connect is the only path ([4de6793](https://github.com/lukislp/studylife-capture/commit/4de6793cd1e340b2e075ab8d1c502a1e72734b4d))

## [1.4.2](https://github.com/lukislp/studylife-capture/compare/v1.4.1...v1.4.2) (2026-08-27)


### Bug Fixes

* survive the popup-killing permission prompt with one click ([7f776ad](https://github.com/lukislp/studylife-capture/commit/7f776ad007b1128890c9e85aabb37f7bad4b4ce6))

## [1.4.1](https://github.com/lukislp/studylife-capture/compare/v1.4.0...v1.4.1) (2026-08-27)


### Bug Fixes

* make the connect click handler async for the awaited permission request ([f0df472](https://github.com/lukislp/studylife-capture/commit/f0df472f51062a8fd6c669a13ef13d5e0612ad8f))
* request the host permission in the popup, not the service worker ([8c64c03](https://github.com/lukislp/studylife-capture/commit/8c64c03ccc27714e691a062728f86b7e35951e1a))

# [1.4.0](https://github.com/lukislp/studylife-capture/compare/v1.3.1...v1.4.0) (2026-08-27)


### Features

* connect via browser consent instead of manual key paste ([2edaf41](https://github.com/lukislp/studylife-capture/commit/2edaf41d1951b279b353ec047477863697474691))

## [1.3.1](https://github.com/lukislp/studylife-capture/compare/v1.3.0...v1.3.1) (2026-08-21)


### Bug Fixes

* self-host DM Sans instead of loading it from Google Fonts ([773d746](https://github.com/lukislp/studylife-capture/commit/773d7462b9e06558dc0bacaa0733b415e628b36d))

# [1.3.0](https://github.com/lukislp/studylife-capture/compare/v1.2.0...v1.3.0) (2026-08-21)


### Features

* use studylife-app's actual AppIcon instead of the web sparkle mark ([7f2d283](https://github.com/lukislp/studylife-capture/commit/7f2d283091e99730241afb616ac4ed567a210258))

# [1.2.0](https://github.com/lukislp/studylife-capture/compare/v1.1.2...v1.2.0) (2026-08-21)


### Features

* replace placeholder icon with StudyLife's actual brand icon ([f0d01ae](https://github.com/lukislp/studylife-capture/commit/f0d01ae9533f4fba1789c70887901bc1ab270850))

## [1.1.2](https://github.com/lukislp/studylife-capture/compare/v1.1.1...v1.1.2) (2026-08-21)


### Bug Fixes

* save settings before requesting the host permission, not after ([fa6f087](https://github.com/lukislp/studylife-capture/commit/fa6f0872b442ebb2dff0a850f7c6e9539ac3ae3a))

## [1.1.1](https://github.com/lukislp/studylife-capture/compare/v1.1.0...v1.1.1) (2026-08-21)


### Bug Fixes

* upload release asset via gh CLI instead of @semantic-release/github ([b95a429](https://github.com/lukislp/studylife-capture/commit/b95a42968ffdcef4f12dff0016c1736c4ae84923))

# [1.1.0](https://github.com/lukislp/studylife-capture/compare/v1.0.0...v1.1.0) (2026-08-21)


### Features

* request server-origin permission at runtime instead of a broad grant ([69c832f](https://github.com/lukislp/studylife-capture/commit/69c832f6c39b3bf84dd67dca7afcb49a2eda30b5))

# 1.0.0 (2026-08-21)


### Bug Fixes

* match studylife-mcp OAuth page styling exactly ([a271007](https://github.com/lukislp/studylife-capture/commit/a271007e5b9b655831dd80ae234b4a6bfbc7a063))
* point capture requests at the real /api/notes endpoint ([28383df](https://github.com/lukislp/studylife-capture/commit/28383dfc4fa586bc2d2e25723c9947ecc47a4618))


### Features

* extension scaffold with context-menu capture and settings popup ([e8f8e8f](https://github.com/lukislp/studylife-capture/commit/e8f8e8f891db0c11ac4984ad532e5ba4f0e0bac0))
* full-article capture via Readability (S3) ([14a7139](https://github.com/lukislp/studylife-capture/commit/14a71397aed6f4597c15eedcd1c7253ab1dde936))
* packaged .zip release build + full CI/CD pipeline (S4) ([a6f0750](https://github.com/lukislp/studylife-capture/commit/a6f0750fe97efd65016e2704f0e7bc773865021b))
* robust offline/invalid-key error handling (S4) ([b565bdc](https://github.com/lukislp/studylife-capture/commit/b565bdcf3c1398270fd7fd06a85b1d21a5ec68f2))
