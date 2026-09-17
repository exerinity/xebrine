# Xebrine
Xebrine (pronounced *zeh-brine*) is a highly customizable, heavy-duty music player designed for people with massive local libraries, power users, and extremely long listening sessions

Made as a non-replacing spiritual successor to [Voxity](https://github.com/exerinity/voxity), Xebrine brings a much more natural feeling interface while also providing some powerful utilities for listeners

> [!IMPORTANT]
> Xebrine, unlike Voxity, is written in TypeScript and uses React for the UI. Voxity is entirely vanilla JavaScript and more of an "ugly utilitarian" app. However, because Xebrine needs the File System Access API, this will only work on Chromium browsers on desktop and Android; and hence will not work on iPhone, Mozilla Firefox, and basically anywhere not Chromium.
> Further, Voxity is *decently lightweight* for what it does; **Xebrine is not a lightweight player at all - it is heavy by design.** If you're conscious about RAM usage, you probably shouldn't use this. (although, it uses about 200 to 350 MB, which is not bad compared to Spotify using 1 GB+...)

> [!CAUTION]
Xebrine is super super early and probably won't work as expected. Known issues include scanning never starts or can choke, rudimental Last.fm handling, janky album rendering, and the player bar isn't very responsive on smaller screens. **Use with caution.**

> [!NOTE]
Xebrine is not a Tauri or Electron music player. [The Rust in this repo](tools) is used to generate [the icons](https://xebrine.com/i/xebrine/icon/icons.txt). There is an [Electron folder](electron), but it is experimental and binaries of it are not distributed.

[![](https://meow.exerinity.gay/xeb2.png)](https://meow.exerinity.gay/xeb2.png)

## List of features
For a full list, see https://xebrine.com/i/info
- Folder scanning via the File System Access API into IndexedDB and sorted properly
- Three different search types: a simple filter, a more natural algorithmical search, and a "Deep search" to find songs based on morsels of metadata
- [Last.fm scrobbling](https://xebrine.com/lastfm)
- [A remote control](https://xebrine.com/remote)
- Online lyric searching and displaying, with click-to-jump lines from [LRCLIB](https://lrclib.net)
- A Spotify-inspired lyrics canvas creator, where you can generate images of selected lines (see screenshots)
- An "auto mix" feature which attempts to beat match songs with a transition duration of your choosing
- A fullscreen player with everything at a glance and the cover art as a background (see screenshots)
- The player bar can be made compact or comfortable, top or bottom, and has drawers for scanning & auto mix
- Context menus with right-click drag actions

## Screenshots
### Fullscreen player
[![](https://meow.exerinity.gay/xeb.png)](https://meow.exerinity.gay/xeb.png)
### Lyrics image creator
[![](https://meow.exerinity.gay/xeb_lrc.png)](https://meow.exerinity.gay/xeb_lrc.png)
### Context menus
[![](https://meow.exerinity.gay/xeb_ctx.png)](https://meow.exerinity.gay/xeb_ctx.png)

## License
Xebrine is available under the [MIT License](LICENSE)

## Other repos
I created an organization for Xebrine, where I'll be sharing more tools it uses. This repo is basically Xebrine as a whole: the Workers backend, entire DSP, and entire app itself, but there is:

[xebrine/icons](https://github.com/xebrine/icons) - which generates the icons, and is written in Rust

This repo might move to xebrine/xebrine, might not, who caresss